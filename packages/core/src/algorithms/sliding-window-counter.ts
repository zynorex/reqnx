// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Sliding Window Counter Algorithm
//
// Approximates a sliding window using weighted counts from the current and
// previous fixed windows. Provides O(1) memory and time complexity with
// smooth rate limiting across window boundaries.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type AlgorithmId, type Decision, type Duration } from '../types.js';
import { ConfigError } from '../errors.js';
import { parseDuration } from '../duration.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Raw user input for the sliding window counter algorithm.
 */
export interface SlidingWindowCounterInput {
  /** Maximum number of requests allowed per window. Safe integer in [1, 2^31 - 1]. */
  readonly limit: number;
  /** Window duration. Milliseconds or a human-readable duration string (e.g. `'1m'`). */
  readonly window: Duration;
}

/**
 * Validated, normalised configuration for the sliding window counter algorithm.
 */
export interface SlidingWindowCounterConfig {
  /** Maximum requests allowed per window. Safe integer in [1, 2^31 - 1]. */
  readonly limit: number;
  /** Window duration in milliseconds. Positive integer. */
  readonly windowMs: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Per-key state for the sliding window counter algorithm.
 */
export interface SlidingWindowCounterState {
  /** Epoch ms of the current window's start. */
  readonly currentWindowStart: number;
  /** Request count in the current window. */
  readonly currentCount: number;
  /** Request count in the previous window. */
  readonly previousCount: number;
}

const MAX_SAFE_LIMIT = 2_147_483_647; // 2^31 - 1

/**
 * Compute epoch-aligned window start.
 *
 * @internal
 */
function alignedWindowStart(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

/**
 * Resolve effective current & previous window counts based on elapsed time.
 *
 * @internal
 */
function resolveState(
  state: SlidingWindowCounterState | undefined,
  nowMs: number,
  windowMs: number,
): SlidingWindowCounterState {
  const currentWindowStart = alignedWindowStart(nowMs, windowMs);

  if (state === undefined) {
    return {
      currentWindowStart,
      currentCount: 0,
      previousCount: 0,
    };
  }

  if (state.currentWindowStart === currentWindowStart) {
    // Same window
    return state;
  }

  if (currentWindowStart < state.currentWindowStart) {
    // Backwards clock jump — clamp to stored state to prevent reset
    return state;
  }

  if (currentWindowStart === state.currentWindowStart + windowMs) {
    // Advanced by exactly 1 window: current becomes previous
    return {
      currentWindowStart,
      currentCount: 0,
      previousCount: state.currentCount,
    };
  }

  // Advanced by 2 or more windows: both previous and current have expired
  return {
    currentWindowStart,
    currentCount: 0,
    previousCount: 0,
  };
}

/**
 * Calculate the estimated request count within the sliding window.
 *
 * @internal
 */
function calculateEstimate(
  state: SlidingWindowCounterState,
  nowMs: number,
  windowMs: number,
): { effectiveNow: number; elapsed: number; scaledPrevious: number; estimatedCount: number } {
  const effectiveNow = Math.max(nowMs, state.currentWindowStart);
  const rawElapsed = effectiveNow - state.currentWindowStart;
  const elapsed = Math.min(rawElapsed, windowMs);

  const scaledPrevious = Math.floor((state.previousCount * (windowMs - elapsed)) / windowMs);
  const estimatedCount = scaledPrevious + state.currentCount;

  return { effectiveNow, elapsed, scaledPrevious, estimatedCount };
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

export const slidingWindowCounter: Algorithm<
  SlidingWindowCounterConfig,
  SlidingWindowCounterState
> = {
  id: 'sliding-window-counter' as AlgorithmId,
  stateVersion: 1,

  parseConfig(input: unknown): SlidingWindowCounterConfig {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ConfigError('Sliding window counter config must be a plain object.');
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
      throw new ConfigError('Sliding window counter `limit` is required.');
    }

    const limit = raw['limit'];
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_SAFE_LIMIT
    ) {
      throw new ConfigError(
        `Sliding window counter \`limit\` must be a safe integer between 1 and ${MAX_SAFE_LIMIT}, got ${String(limit)}.`,
      );
    }

    if (!('window' in raw)) {
      throw new ConfigError('Sliding window counter `window` is required.');
    }

    const windowMs = parseDuration(raw['window'] as Duration);

    return { limit, windowMs };
  },

  step(
    state: SlidingWindowCounterState | undefined,
    config: SlidingWindowCounterConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: SlidingWindowCounterState } {
    const resolved = resolveState(state, nowMs, config.windowMs);
    const { estimatedCount } = calculateEstimate(resolved, nowMs, config.windowMs);

    const allowed = estimatedCount + cost <= config.limit;
    const nextCurrentCount = allowed ? resolved.currentCount + cost : resolved.currentCount;
    const nextEstimatedCount = allowed ? estimatedCount + cost : estimatedCount;
    const remaining = config.limit - nextEstimatedCount;
    const windowEnd = resolved.currentWindowStart + config.windowMs;

    let retryAfterMs = 0;
    if (!allowed) {
      if (cost > config.limit) {
        retryAfterMs = config.windowMs;
      } else {
        const K = config.limit - resolved.currentCount - cost;
        if (K < 0 || resolved.previousCount <= 0) {
          retryAfterMs = Math.max(1, windowEnd - nowMs);
        } else {
          // Find earliest elapsed' where floor(previousCount * (windowMs - elapsed') / windowMs) <= K
          const neededElapsed = config.windowMs - Math.floor((K * config.windowMs) / resolved.previousCount);
          const dropTargetTime = resolved.currentWindowStart + neededElapsed;
          retryAfterMs = Math.max(1, dropTargetTime - nowMs);
        }
      }
    }

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
        currentWindowStart: resolved.currentWindowStart,
        currentCount: nextCurrentCount,
        previousCount: resolved.previousCount,
      },
    };
  },

  peek(
    state: SlidingWindowCounterState | undefined,
    config: SlidingWindowCounterConfig,
    nowMs: number,
  ): Decision {
    const resolved = resolveState(state, nowMs, config.windowMs);
    const { estimatedCount } = calculateEstimate(resolved, nowMs, config.windowMs);

    const allowed = estimatedCount + 1 <= config.limit;
    const remaining = config.limit - estimatedCount;
    const windowEnd = resolved.currentWindowStart + config.windowMs;

    let retryAfterMs = 0;
    if (!allowed) {
      const K = config.limit - resolved.currentCount - 1;
      if (K < 0 || resolved.previousCount <= 0) {
        retryAfterMs = Math.max(1, windowEnd - nowMs);
      } else {
        const neededElapsed = config.windowMs - Math.floor((K * config.windowMs) / resolved.previousCount);
        const dropTargetTime = resolved.currentWindowStart + neededElapsed;
        retryAfterMs = Math.max(1, dropTargetTime - nowMs);
      }
    }

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAtMs: windowEnd,
      retryAfterMs,
      degraded: false,
    };
  },

  stateTtlMs(config: SlidingWindowCounterConfig): number {
    return 2 * config.windowMs;
  },
};
