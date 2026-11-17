// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Leaky Bucket Rate-Limiting Algorithm (Meter)
//
// Models rate limiting using a leaky bucket as a meter (water metaphor).
// Incoming requests add water corresponding to their cost.
// Water drains continuously at an exact rational rate of `leak` per `interval`.
//
// Implemented on top of the token bucket's exact arithmetic engine (delegating
// arithmetic to avoid duplicate logic) and proven equivalent via property tests.
//
// Zero floating-point drift, zero external dependencies.
// Documented in ADR-0027 and ADR-0028.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type AlgorithmId, type Decision, type Duration } from '../types.js';
import { ConfigError } from '../errors.js';
import { MAX_DURATION_MS, parseDuration } from '../duration.js';
import {
  MAX_SAFE_CAPACITY,
  MAX_CAPACITY_UNITS,
  normaliseRate,
  tokenBucket,
  type TokenBucketConfig,
  type TokenBucketState,
} from './token-bucket.js';

// ─── Config Types ─────────────────────────────────────────────────────────────

/**
 * Raw user-facing configuration for the leaky bucket meter algorithm.
 *
 * Validated and normalised by {@link leakyBucket.parseConfig}.
 *
 * @example
 * ```ts
 * const config: LeakyBucketInput = {
 *   capacity: 10,
 *   leak: 2,
 *   interval: '1s',
 * };
 * ```
 */
export interface LeakyBucketInput {
  /**
   * Maximum capacity (volume) the bucket can hold in whole units.
   * Safe integer in `[1, 2^31 - 1]`.
   */
  readonly capacity: number;

  /**
   * Amount of water that leaks per interval.
   * Safe integer in `[1, 2^31 - 1]`.
   */
  readonly leak: number;

  /**
   * Duration between leaks. Milliseconds or string (e.g. `'1s'`, `'500ms'`).
   */
  readonly interval?: Duration;

  /**
   * Ergonomic alias for {@link interval}.
   */
  readonly leakInterval?: Duration;
}

/**
 * Validated, normalised configuration for the leaky bucket algorithm.
 *
 * All rate parameters are pre-normalised to irreducible integers `a` and `b`
 * such that the leak rate is `a / b` units per millisecond.
 */
export interface LeakyBucketConfig {
  /** Maximum capacity in whole units. Safe integer in `[1, 2^31 - 1]`. */
  readonly capacity: number;
  /** Leak amount as specified in input. */
  readonly leak: number;
  /** Leak interval duration in milliseconds. Positive integer. */
  readonly intervalMs: number;
  /**
   * Normalised rate numerator: `leak / gcd(leak, intervalMs)`.
   * Represents internal units leaked per elapsed millisecond.
   */
  readonly a: number;
  /**
   * Normalised rate denominator: `intervalMs / gcd(leak, intervalMs)`.
   * Represents internal units per 1 whole unit of capacity.
   */
  readonly b: number;
  /**
   * Maximum capacity in internal units: `capacity * b`.
   */
  readonly capacityUnits: number;
  /**
   * Time in milliseconds for a completely full bucket to drain to empty:
   * `ceil(capacityUnits / a)`. Equal to token bucket's full refill time.
   */
  readonly drainTimeMs: number;
}

// ─── State Types ──────────────────────────────────────────────────────────────

/**
 * Per-key persistent state for the leaky bucket algorithm.
 *
 * Stored and managed by the {@link Store}. Versioned via
 * {@link leakyBucket.stateVersion}.
 *
 * Tracks available room in internal units (where 1 unit of room = `b` units).
 * In water terms: `level = capacityUnits - waterLevel`.
 */
export interface LeakyBucketState {
  /**
   * Current room level in internal units (where `b` units = 1 whole unit).
   * Integer in `[0, capacityUnits]`.
   * At 0: bucket is completely full of water (no room remaining).
   * At capacityUnits: bucket is completely empty (all capacity available).
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

// ─── Internal Helper: Config Adapter ──────────────────────────────────────────

/**
 * Convert {@link LeakyBucketConfig} to equivalent {@link TokenBucketConfig}
 * for zero-overhead arithmetic delegation.
 *
 * @internal
 */
export function toTokenBucketConfig(config: LeakyBucketConfig): TokenBucketConfig {
  return {
    capacity: config.capacity,
    refillTokens: config.leak,
    refillIntervalMs: config.intervalMs,
    a: config.a,
    b: config.b,
    capacityUnits: config.capacityUnits,
    fullRefillMs: config.drainTimeMs,
  };
}

// ─── Algorithm Implementation ─────────────────────────────────────────────────

/**
 * Leaky Bucket rate-limiting algorithm (Meter variant).
 *
 * ### Water Metaphor
 * - The bucket starts **empty** (all capacity is available).
 * - A request adds its `cost` to the water level.
 * - An overflow (`level + cost > capacity`) is a denial that leaves the bucket level unchanged.
 * - The bucket leaks continuously at an exact rational rate of `leak / interval`.
 *
 * ### Mathematical Equivalence
 * With equivalent parameters (`capacity = capacity`, `leak = refillTokens`, `interval = refillInterval`),
 * the Leaky Bucket meter and Token Bucket are mathematically identical state machines and make
 * identical allow and deny decisions. The difference is purely conceptual vocabulary:
 * - Leaky bucket measures **used volume** draining to empty.
 * - Token bucket measures **available permits** refilling to full.
 *
 * ### Decision Field Semantics
 * | Field          | Leaky Bucket Meaning                                           |
 * |----------------|----------------------------------------------------------------|
 * | `limit`        | Configured maximum bucket capacity                             |
 * | `remaining`    | Whole units of room available in the bucket (`capacity - water`)|
 * | `resetAtMs`    | Epoch ms when the bucket will be completely empty (drained)    |
 * | `retryAfterMs` | 0 if allowed; exact ms until enough water leaks to fit cost    |
 *
 * @example
 * ```ts
 * import { createLimiter, createMemoryStore, leakyBucket } from '@reqnx/core';
 *
 * const limiter = createLimiter({
 *   algorithm: leakyBucket,
 *   store: createMemoryStore(),
 *   prefix: 'api',
 *   config: { capacity: 10, leak: 2, interval: '1s' },
 * });
 *
 * const decision = await limiter.check('client-ip');
 * ```
 */
export const leakyBucket: Algorithm<LeakyBucketConfig, LeakyBucketState> = {
  id: 'leaky-bucket' as AlgorithmId,
  stateVersion: 1,

  parseConfig(input: unknown): LeakyBucketConfig {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ConfigError('Leaky bucket config must be a plain object.');
    }

    const raw = input as Record<string, unknown>;
    const allowedKeys = ['capacity', 'leak', 'interval', 'leakInterval'];
    const extraKeys = Object.keys(raw).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      throw new ConfigError(
        `Unknown config key(s): ${extraKeys.join(', ')}. Allowed keys are: ${allowedKeys.join(', ')}.`,
      );
    }

    if (!('capacity' in raw)) {
      throw new ConfigError('Leaky bucket `capacity` is required.');
    }

    const capacity = raw['capacity'];
    if (
      typeof capacity !== 'number' ||
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      capacity > MAX_SAFE_CAPACITY
    ) {
      throw new ConfigError(
        `Leaky bucket \`capacity\` must be a safe integer between 1 and ${MAX_SAFE_CAPACITY}, got ${String(capacity)}.`,
      );
    }

    if (!('leak' in raw)) {
      throw new ConfigError('Leaky bucket `leak` is required.');
    }

    const leak = raw['leak'];
    if (
      typeof leak !== 'number' ||
      !Number.isSafeInteger(leak) ||
      leak < 1 ||
      leak > MAX_SAFE_CAPACITY
    ) {
      throw new ConfigError(
        `Leaky bucket \`leak\` must be a safe integer between 1 and ${MAX_SAFE_CAPACITY}, got ${String(leak)}.`,
      );
    }

    const hasInterval = 'interval' in raw;
    const hasLeakInterval = 'leakInterval' in raw;

    if (!hasInterval && !hasLeakInterval) {
      throw new ConfigError('Leaky bucket `interval` (or `leakInterval`) is required.');
    }

    let intervalDuration: Duration;
    if (hasInterval && hasLeakInterval) {
      const ms1 = parseDuration(raw['interval'] as Duration);
      const ms2 = parseDuration(raw['leakInterval'] as Duration);
      if (ms1 !== ms2) {
        throw new ConfigError(
          `Conflicting interval (${ms1}ms) and leakInterval (${ms2}ms) provided. Use either interval or leakInterval.`,
        );
      }
      intervalDuration = raw['interval'] as Duration;
    } else {
      intervalDuration = (hasInterval ? raw['interval'] : raw['leakInterval']) as Duration;
    }

    const intervalMs = parseDuration(intervalDuration);

    const { a, b } = normaliseRate(leak, intervalMs);
    const capacityUnits = capacity * b;

    if (capacityUnits > MAX_CAPACITY_UNITS) {
      throw new ConfigError(
        `Leaky bucket capacityUnits (${capacityUnits}) exceeds maximum safe limit of 2^51 (${MAX_CAPACITY_UNITS}). Reduce capacity or interval.`,
      );
    }

    const drainTimeMs = Math.ceil(capacityUnits / a);
    if (drainTimeMs > MAX_DURATION_MS) {
      throw new ConfigError(
        `Leaky bucket full drain time (${drainTimeMs} ms) exceeds the maximum allowed duration of ${MAX_DURATION_MS} ms (366 days). Increase leak or decrease capacity/interval.`,
      );
    }

    return {
      capacity,
      leak,
      intervalMs,
      a,
      b,
      capacityUnits,
      drainTimeMs,
    };
  },

  step(
    state: LeakyBucketState | undefined,
    config: LeakyBucketConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: LeakyBucketState } {
    const tbConfig = toTokenBucketConfig(config);
    const tbState = state as unknown as TokenBucketState | undefined;
    const result = tokenBucket.step(tbState, tbConfig, nowMs, cost);
    return {
      decision: result.decision,
      nextState: result.nextState as unknown as LeakyBucketState,
    };
  },

  peek(state: LeakyBucketState | undefined, config: LeakyBucketConfig, nowMs: number): Decision {
    const tbConfig = toTokenBucketConfig(config);
    const tbState = state as unknown as TokenBucketState | undefined;
    return tokenBucket.peek(tbState, tbConfig, nowMs);
  },

  stateTtlMs(config: LeakyBucketConfig): number {
    return config.drainTimeMs;
  },
};
