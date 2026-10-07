// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Token Bucket Rate-Limiting Algorithm
//
// Refills tokens continuously at an exact rational rate of
// `refillTokens` per `refillInterval`, up to a maximum `capacity`.
//
// Implemented via exact integer fixed-point arithmetic (units of 1/b token).
// Zero floating-point drift, zero external dependencies.
//
// Design decisions documented in ADR-0014.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type AlgorithmId, type Decision, type Duration } from '../types.js';
import { ConfigError } from '../errors.js';
import { MAX_DURATION_MS, parseDuration } from '../duration.js';

// ─── Constants & Bounds ───────────────────────────────────────────────────────

/**
 * Maximum safe capacity: 2^31 - 1 (signed 32-bit integer).
 */
export const MAX_SAFE_CAPACITY = 2_147_483_647;

/**
 * Maximum internal capacity units: 2^51.
 *
 * Ensures `level + clampedRefill <= 2 * capacityUnits + a` stays strictly below
 * IEEE 754 safe integer limit (2^53 - 1) in JavaScript and Redis Lua double precision.
 */
export const MAX_CAPACITY_UNITS = 2_251_799_813_685_248; // 2^51

// ─── Config Types ─────────────────────────────────────────────────────────────

/**
 * Raw user-facing configuration for the token bucket algorithm.
 *
 * Validated and normalised by {@link tokenBucket.parseConfig}.
 *
 * @example
 * ```ts
 * const config: TokenBucketInput = {
 *   capacity: 10,
 *   refillTokens: 2,
 *   refillInterval: '1s',
 * };
 * ```
 */
export interface TokenBucketInput {
  /** Maximum number of tokens the bucket can hold. Safe integer in [1, 2^31 - 1]. */
  readonly capacity: number;
  /** Number of tokens refilled per interval. Safe integer in [1, 2^31 - 1]. */
  readonly refillTokens: number;
  /** Duration between refills. Milliseconds or string (e.g. `'1s'`, `'500ms'`). */
  readonly refillInterval: Duration;
}

/**
 * Validated, normalised configuration for the token bucket algorithm.
 *
 * All rate parameters are pre-normalised to irreducible integers `a` and `b`
 * such that the rate is `a / b` tokens per millisecond.
 */
export interface TokenBucketConfig {
  /** Maximum burst capacity in whole tokens. Safe integer in [1, 2^31 - 1]. */
  readonly capacity: number;
  /** Refill tokens as specified in input. */
  readonly refillTokens: number;
  /** Refill interval duration in milliseconds. Positive integer. */
  readonly refillIntervalMs: number;
  /**
   * Normalised rate numerator: `refillTokens / gcd(refillTokens, refillIntervalMs)`.
   * Represents internal units added per elapsed millisecond.
   */
  readonly a: number;
  /**
   * Normalised rate denominator: `refillIntervalMs / gcd(refillTokens, refillIntervalMs)`.
   * Represents internal units per 1 whole token.
   */
  readonly b: number;
  /**
   * Maximum capacity in internal units: `capacity * b`.
   */
  readonly capacityUnits: number;
  /**
   * Time in milliseconds for an empty bucket to refill to full: `ceil(capacityUnits / a)`.
   */
  readonly fullRefillMs: number;
}

// ─── State Types ──────────────────────────────────────────────────────────────

/**
 * Per-key persistent state for the token bucket algorithm.
 *
 * Stored and managed by the {@link Store}. Versioned via
 * {@link tokenBucket.stateVersion}.
 */
export interface TokenBucketState {
  /**
   * Current token level in internal units (where 1 token = `b` units).
   * Integer in `[0, capacityUnits]`.
   */
  readonly level: number;
  /**
   * Epoch timestamp in milliseconds of the last admission / reference instant.
   */
  readonly at: number;
  /**
   * Rate numerator under which this state was written.
   */
  readonly a: number;
  /**
   * Rate denominator under which this state was written.
   */
  readonly b: number;
}

// ─── Pure Arithmetic Helpers ──────────────────────────────────────────────────

/**
 * Greatest common divisor using Euclidean algorithm.
 *
 * @internal
 */
export function gcd(x: number, y: number): number {
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Normalise refillTokens and refillIntervalMs into coprime integers (a, b).
 *
 * @internal
 */
export function normaliseRate(
  refillTokens: number,
  refillIntervalMs: number,
): { a: number; b: number } {
  const g = gcd(refillTokens, refillIntervalMs);
  return {
    a: refillTokens / g,
    b: refillIntervalMs / g,
  };
}

/**
 * Resolve starting level and effective timestamp, handling:
 * - Fresh state (`undefined`): start full at `nowMs`
 * - Same rate: keep existing level units
 * - Changed rate: convert whole tokens conservatively (`min(floor(level/b), capacity) * newB`)
 * - Backwards clock: clamp `effectiveNow` to `state.at` (no negative refill)
 * - Elapsed refill: clamp elapsed to `fullRefillMs` before multiplying to prevent overflow
 *
 * @internal
 */
export function resolveStartingLevel(
  state: TokenBucketState | undefined,
  config: TokenBucketConfig,
  nowMs: number,
): { effectiveNow: number; refilled: number } {
  if (state === undefined) {
    return {
      effectiveNow: nowMs,
      refilled: config.capacityUnits,
    };
  }

  // Backwards clock protection: never let reference instant move backwards
  const effectiveNow = Math.max(nowMs, state.at);
  const elapsed = effectiveNow - state.at;

  let level: number;
  if (state.a === config.a && state.b === config.b) {
    // Same rate: keep units directly
    level = state.level;
  } else {
    // Rate changed: convert whole tokens conservatively, clamped before multiplying
    const wholeTokens = Math.min(Math.floor(state.level / state.b), config.capacity);
    level = wholeTokens * config.b;
  }

  // Clamp elapsed before multiplying to guarantee safe integer bounds
  const clampedElapsed = Math.min(elapsed, config.fullRefillMs);
  const refilled = Math.min(config.capacityUnits, level + clampedElapsed * config.a);

  return { effectiveNow, refilled };
}

// ─── Algorithm Implementation ─────────────────────────────────────────────────

/**
 * Token Bucket rate-limiting algorithm.
 *
 * ### Semantics
 * - Smooth token replenishment using exact rational arithmetic (`a/b` tokens/ms).
 * - State is tracked in units of `1/b` token: `capacityUnits = capacity * b`.
 * - Denied requests do not mutate state (no write, no refill clock advancement).
 * - Monotonic under backward clock jumps (NTP adjustments).
 * - Pure integer arithmetic: zero floating-point math, zero drift.
 *
 * ### Decision field semantics
 * | Field          | Meaning                                                      |
 * |----------------|--------------------------------------------------------------|
 * | `limit`        | Configured maximum burst capacity                            |
 * | `remaining`    | Whole tokens currently available after check (`floor(level/b)`)|
 * | `resetAtMs`    | Epoch ms when bucket will be fully refilled (`capacity`)      |
 * | `retryAfterMs` | 0 if allowed; exact ms until required tokens refill if denied|
 *
 * @example
 * ```ts
 * import { createLimiter, createMemoryStore, tokenBucket } from '@reqnx/core';
 *
 * const limiter = createLimiter({
 *   algorithm: tokenBucket,
 *   store: createMemoryStore(),
 *   prefix: 'api',
 *   config: { capacity: 10, refillTokens: 1, refillInterval: '1s' },
 * });
 *
 * const decision = await limiter.check('client-ip');
 * ```
 */
export const tokenBucket: Algorithm<TokenBucketConfig, TokenBucketState> = {
  id: 'token-bucket' as AlgorithmId,
  stateVersion: 1,

  parseConfig(input: unknown): TokenBucketConfig {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ConfigError('Token bucket config must be a plain object.');
    }

    const raw = input as Record<string, unknown>;
    const allowedKeys = ['capacity', 'refillTokens', 'refillInterval'];
    const extraKeys = Object.keys(raw).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      throw new ConfigError(
        `Unknown config key(s): ${extraKeys.join(', ')}. Allowed keys are: ${allowedKeys.join(', ')}.`,
      );
    }

    if (!('capacity' in raw)) {
      throw new ConfigError('Token bucket `capacity` is required.');
    }

    const capacity = raw['capacity'];
    if (
      typeof capacity !== 'number' ||
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      capacity > MAX_SAFE_CAPACITY
    ) {
      throw new ConfigError(
        `Token bucket \`capacity\` must be a safe integer between 1 and ${MAX_SAFE_CAPACITY}, got ${String(capacity)}.`,
      );
    }

    if (!('refillTokens' in raw)) {
      throw new ConfigError('Token bucket `refillTokens` is required.');
    }

    const refillTokens = raw['refillTokens'];
    if (
      typeof refillTokens !== 'number' ||
      !Number.isSafeInteger(refillTokens) ||
      refillTokens < 1 ||
      refillTokens > MAX_SAFE_CAPACITY
    ) {
      throw new ConfigError(
        `Token bucket \`refillTokens\` must be a safe integer between 1 and ${MAX_SAFE_CAPACITY}, got ${String(refillTokens)}.`,
      );
    }

    if (!('refillInterval' in raw)) {
      throw new ConfigError('Token bucket `refillInterval` is required.');
    }

    const refillInterval = raw['refillInterval'];
    const refillIntervalMs = parseDuration(refillInterval as Duration);

    const { a, b } = normaliseRate(refillTokens, refillIntervalMs);
    const capacityUnits = capacity * b;

    if (capacityUnits > MAX_CAPACITY_UNITS) {
      throw new ConfigError(
        `Token bucket capacityUnits (${capacityUnits}) exceeds maximum safe limit of 2^51 (${MAX_CAPACITY_UNITS}). Reduce capacity or refillInterval.`,
      );
    }

    const fullRefillMs = Math.ceil(capacityUnits / a);
    if (fullRefillMs > MAX_DURATION_MS) {
      throw new ConfigError(
        `Token bucket full refill time (${fullRefillMs} ms) exceeds the maximum allowed duration of ${MAX_DURATION_MS} ms (366 days). Increase refillTokens or decrease capacity/refillInterval.`,
      );
    }

    return {
      capacity,
      refillTokens,
      refillIntervalMs,
      a,
      b,
      capacityUnits,
      fullRefillMs,
    };
  },

  step(
    state: TokenBucketState | undefined,
    config: TokenBucketConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: TokenBucketState } {
    const { effectiveNow, refilled } = resolveStartingLevel(state, config, nowMs);

    // If cost exceeds capacity, request can never be admitted.
    // Handled before any multiplication to prevent overflow on extreme costs.
    if (cost > config.capacity) {
      const levelAfter = refilled;
      const remaining = Math.floor(levelAfter / config.b);
      const unitsToFull = config.capacityUnits - levelAfter;
      const msToFull = unitsToFull > 0 ? Math.ceil(unitsToFull / config.a) : config.fullRefillMs;
      const resetAtMs = effectiveNow + Math.ceil(unitsToFull / config.a);
      const retryAfterMs = (effectiveNow + msToFull) - nowMs;

      return {
        decision: {
          allowed: false,
          limit: config.capacity,
          remaining,
          resetAtMs,
          retryAfterMs,
          degraded: false,
        },
        nextState: state ?? {
          level: config.capacityUnits,
          at: effectiveNow,
          a: config.a,
          b: config.b,
        },
      };
    }

    const need = cost * config.b;
    const allowed = refilled >= need;
    const levelAfter = allowed ? refilled - need : refilled;
    const remaining = Math.floor(levelAfter / config.b);
    const resetAtMs = effectiveNow + Math.ceil((config.capacityUnits - levelAfter) / config.a);
    const retryAfterMs = allowed
      ? 0
      : (effectiveNow + Math.ceil((need - refilled) / config.a)) - nowMs;

    return {
      decision: {
        allowed,
        limit: config.capacity,
        remaining,
        resetAtMs,
        retryAfterMs,
        degraded: false,
      },
      nextState: allowed
        ? {
            level: levelAfter,
            at: effectiveNow,
            a: config.a,
            b: config.b,
          }
        : state!,
    };
  },

  peek(
    state: TokenBucketState | undefined,
    config: TokenBucketConfig,
    nowMs: number,
  ): Decision {
    const { effectiveNow, refilled } = resolveStartingLevel(state, config, nowMs);

    const need = config.b; // 1 token
    const allowed = refilled >= need;
    const levelAfter = refilled;
    const remaining = Math.floor(levelAfter / config.b);
    const resetAtMs = effectiveNow + Math.ceil((config.capacityUnits - levelAfter) / config.a);
    const retryAfterMs = allowed
      ? 0
      : (effectiveNow + Math.ceil((need - refilled) / config.a)) - nowMs;

    return {
      allowed,
      limit: config.capacity,
      remaining,
      resetAtMs,
      retryAfterMs,
      degraded: false,
    };
  },

  stateTtlMs(config: TokenBucketConfig): number {
    return config.fullRefillMs;
  },
};
