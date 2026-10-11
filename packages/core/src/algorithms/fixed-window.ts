// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Fixed Window Counter Algorithm
//
// Divides time into non-overlapping, epoch-aligned windows of `windowMs`
// milliseconds. Each window allows up to `limit` requests. When the window
// expires, a fresh window begins with a full quota.
//
// Design decisions documented in ADR-0010.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type AlgorithmId, type Decision, type Duration } from '../types.js';
import { ConfigError } from '../errors.js';
import { parseDuration } from '../duration.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Raw user-facing input for the fixed window algorithm.
 *
 * Validated and normalised by {@link fixedWindow.parseConfig}.
 *
 * @example
 * ```ts
 * const config: FixedWindowInput = { limit: 100, window: '1m' };
 * ```
 */
export interface FixedWindowInput {
  /** Maximum number of requests allowed per window. Safe integer in [1, 2^31 - 1]. */
  readonly limit: number;
  /** Window duration. Accepts milliseconds or a human-readable string (e.g. `'30s'`, `'1m'`). */
  readonly window: Duration;
}

/**
 * Validated, normalised configuration for the fixed window algorithm.
 *
 * Produced by {@link fixedWindow.parseConfig} — consumers should not construct
 * this directly.
 */
export interface FixedWindowConfig {
  /** Maximum requests per window. Safe integer in [1, 2^31 - 1]. */
  readonly limit: number;
  /** Window duration in milliseconds. Positive integer. */
  readonly windowMs: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Per-key state for the fixed window algorithm.
 *
 * Stored and managed by the {@link Store}. Versioned via
 * {@link fixedWindow.stateVersion}.
 */
export interface FixedWindowState {
  /** Epoch ms of the current window's start (aligned to epoch). */
  readonly windowStart: number;
  /** Number of tokens consumed in the current window. */
  readonly count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the epoch-aligned window start for a given timestamp.
 *
 * Windows are aligned to epoch: `windowStart = floor(nowMs / windowMs) * windowMs`.
 * A request at exactly `windowStart + windowMs` belongs to the next window.
 *
 * @internal
 */
function alignedWindowStart(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

/**
 * Resolve the effective window start and current count, handling:
 * - Fresh state (undefined) → new window
 * - Same window → carry count
 * - New window (time advanced) → reset count
 * - Backwards clock → clamp to stored window (monotonicity guarantee)
 *
 * @internal
 */
function resolveWindow(
  state: FixedWindowState | undefined,
  nowMs: number,
  windowMs: number,
): { windowStart: number; count: number } {
  const currentWindowStart = alignedWindowStart(nowMs, windowMs);

  if (state === undefined) {
    return { windowStart: currentWindowStart, count: 0 };
  }

  if (state.windowStart === currentWindowStart) {
    // Same window: carry existing count
    return { windowStart: currentWindowStart, count: state.count };
  }

  if (currentWindowStart < state.windowStart) {
    // Clock moved backwards — clamp to stored window to avoid being more generous.
    // Per ADR-0002 / ADR-0010: never reset early on backwards clock.
    return { windowStart: state.windowStart, count: state.count };
  }

  // Time advanced past stored window: fresh window
  return { windowStart: currentWindowStart, count: 0 };
}

const MAX_SAFE_LIMIT = 2_147_483_647; // 2^31 - 1

// ─── Algorithm ────────────────────────────────────────────────────────────────

/**
 * Fixed Window Counter rate-limiting algorithm.
 *
 * ### Semantics
 * - Windows are **epoch-aligned**: `windowStart = floor(nowMs / windowMs) * windowMs`.
 *   All clients sharing the same key see identical window boundaries.
 * - Denied requests **do not increment** the count (no consumption on rejection).
 * - When the clock moves backwards (NTP corrections), the algorithm clamps
 *   to the stored window and never resets early (ADR-0002 monotonicity).
 *
 * ### Decision field semantics
 * | Field          | Meaning                                       |
 * |----------------|-----------------------------------------------|
 * | `limit`        | Configured limit for the window               |
 * | `remaining`    | Admitted capacity remaining in current window |
 * | `resetAtMs`    | Epoch ms when the current window closes       |
 * | `retryAfterMs` | 0 if allowed; ms until window resets if denied (≥ 1) |
 *
 * @example
 * ```ts
 * import { createLimiter, createMemoryStore, fixedWindow } from '@reqnx/core';
 *
 * const limiter = createLimiter({
 *   algorithm: fixedWindow,
 *   store: createMemoryStore(),
 *   prefix: 'api',
 *   config: { limit: 100, window: '1m' },
 * });
 *
 * const decision = await limiter.check('user-123');
 * if (!decision.allowed) {
 *   // Rate limited — retry after decision.retryAfterMs
 * }
 * ```
 */
export const fixedWindow: Algorithm<FixedWindowConfig, FixedWindowState> = {
  id: 'fixed-window' as AlgorithmId,
  stateVersion: 1,

  parseConfig(input: unknown): FixedWindowConfig {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ConfigError('Fixed window config must be a plain object.');
    }

    const raw = input as Record<string, unknown>;
    const allowedKeys = ['limit', 'window'];
    const extraKeys = Object.keys(raw).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      throw new ConfigError(
        `Unknown config key(s): ${extraKeys.join(', ')}. Allowed keys are: ${allowedKeys.join(', ')}.`,
      );
    }

    if (!('limit' in raw)) {
      throw new ConfigError('Fixed window `limit` is required.');
    }

    const limit = raw['limit'];
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_SAFE_LIMIT
    ) {
      throw new ConfigError(
        `Fixed window \`limit\` must be a safe integer between 1 and ${MAX_SAFE_LIMIT}, got ${String(limit)}.`,
      );
    }

    if (!('window' in raw)) {
      throw new ConfigError('Fixed window `window` is required.');
    }

    const window = raw['window'];
    const windowMs = parseDuration(window as Duration);

    return { limit, windowMs };
  },

  step(
    state: FixedWindowState | undefined,
    config: FixedWindowConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: FixedWindowState } {
    const { windowStart, count } = resolveWindow(state, nowMs, config.windowMs);

    const allowed = count + cost <= config.limit;
    const nextCount = allowed ? count + cost : count;
    const remaining = config.limit - nextCount;
    const windowEnd = windowStart + config.windowMs;
    const retryAfterMs = allowed ? 0 : Math.max(1, windowEnd - nowMs);

    return {
      decision: {
        allowed,
        limit: config.limit,
        remaining,
        resetAtMs: windowEnd,
        retryAfterMs,
        degraded: false,
      },
      nextState: {
        windowStart,
        count: nextCount,
      },
    };
  },

  peek(state: FixedWindowState | undefined, config: FixedWindowConfig, nowMs: number): Decision {
    const { windowStart, count } = resolveWindow(state, nowMs, config.windowMs);

    // allowed means a cost-1 request would succeed now
    const allowed = count + 1 <= config.limit;
    const remaining = config.limit - count;
    const windowEnd = windowStart + config.windowMs;
    const retryAfterMs = allowed ? 0 : Math.max(1, windowEnd - nowMs);

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAtMs: windowEnd,
      retryAfterMs,
      degraded: false,
    };
  },

  stateTtlMs(config: FixedWindowConfig): number {
    return config.windowMs;
  },
};
