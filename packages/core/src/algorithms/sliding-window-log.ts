// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Sliding Window Log Algorithm
//
// Maintains a precise timestamp log of admitted requests within a sliding
// window of duration `windowMs`. Provides exact windowing with zero boundary
// burst vulnerability at the cost of O(limit) memory.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type AlgorithmId, type Decision, type Duration } from '../types.js';
import { ConfigError } from '../errors.js';
import { parseDuration } from '../duration.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Raw user input for the sliding window log algorithm.
 */
export interface SlidingWindowLogInput {
  /** Maximum number of requests allowed within the sliding window. Safe integer in [1, 2^31 - 1]. */
  readonly limit: number;
  /** Window duration. Milliseconds or a human-readable duration string (e.g. `'10s'`, `'1m'`). */
  readonly window: Duration;
}

/**
 * Validated, normalised configuration for the sliding window log algorithm.
 */
export interface SlidingWindowLogConfig {
  /** Maximum requests allowed in the sliding window. Safe integer in [1, 2^31 - 1]. */
  readonly limit: number;
  /** Window duration in milliseconds. Positive integer. */
  readonly windowMs: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * An individual log entry recording the timestamp and admitted cost.
 */
export interface SlidingWindowLogEntry {
  readonly timestamp: number;
  readonly cost: number;
}

/**
 * Per-key state for the sliding window log algorithm.
 */
export interface SlidingWindowLogState {
  /** Log of active admissions within the sliding window, ordered by timestamp. */
  readonly logs: readonly SlidingWindowLogEntry[];
}

const MAX_SAFE_LIMIT = 2_147_483_647; // 2^31 - 1

/**
 * Prune log entries older than `effectiveNow - windowMs`.
 *
 * @internal
 */
function pruneLogs(
  logs: readonly SlidingWindowLogEntry[] | undefined,
  thresholdMs: number,
): readonly SlidingWindowLogEntry[] {
  if (!logs || logs.length === 0) return [];
  const active: SlidingWindowLogEntry[] = [];
  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i]!;
    if (entry.timestamp > thresholdMs) {
      active.push(entry);
    }
  }
  return active;
}

/**
 * Compute the total admitted cost across active log entries.
 *
 * @internal
 */
function sumCost(logs: readonly SlidingWindowLogEntry[]): number {
  let sum = 0;
  for (let i = 0; i < logs.length; i++) {
    sum += logs[i]!.cost;
  }
  return sum;
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

export const slidingWindowLog: Algorithm<SlidingWindowLogConfig, SlidingWindowLogState> = {
  id: 'sliding-window-log' as AlgorithmId,
  stateVersion: 1,

  parseConfig(input: unknown): SlidingWindowLogConfig {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ConfigError('Sliding window log config must be a plain object.');
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
      throw new ConfigError('Sliding window log `limit` is required.');
    }

    const limit = raw['limit'];
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_SAFE_LIMIT
    ) {
      throw new ConfigError(
        `Sliding window log \`limit\` must be a safe integer between 1 and ${MAX_SAFE_LIMIT}, got ${String(limit)}.`,
      );
    }

    if (!('window' in raw)) {
      throw new ConfigError('Sliding window log `window` is required.');
    }

    const windowMs = parseDuration(raw['window'] as Duration);

    return { limit, windowMs };
  },

  step(
    state: SlidingWindowLogState | undefined,
    config: SlidingWindowLogConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: SlidingWindowLogState } {
    // Monotonicity under backwards clock: effective time never moves before latest entry
    const latestTimestamp = state && state.logs.length > 0 ? state.logs[state.logs.length - 1]!.timestamp : 0;
    const effectiveNow = Math.max(nowMs, latestTimestamp);

    const thresholdMs = effectiveNow - config.windowMs;
    const activeLogs = pruneLogs(state?.logs, thresholdMs);
    const currentCount = sumCost(activeLogs);

    const allowed = currentCount + cost <= config.limit;
    const nextLogs = allowed ? [...activeLogs, { timestamp: effectiveNow, cost }] : activeLogs;
    const nextCount = allowed ? currentCount + cost : currentCount;
    const remaining = config.limit - nextCount;

    // Reset timestamp: when all entries in the window will have expired
    const newestTimestamp = nextLogs.length > 0 ? nextLogs[nextLogs.length - 1]!.timestamp : effectiveNow;
    const resetAtMs = newestTimestamp + config.windowMs;

    let retryAfterMs = 0;
    if (!allowed) {
      if (cost > config.limit) {
        retryAfterMs = config.windowMs;
      } else {
        const neededToDrop = currentCount + cost - config.limit;
        let accumulatedDropped = 0;
        let dropTargetTime = effectiveNow + config.windowMs;

        for (let i = 0; i < activeLogs.length; i++) {
          accumulatedDropped += activeLogs[i]!.cost;
          if (accumulatedDropped >= neededToDrop) {
            dropTargetTime = activeLogs[i]!.timestamp + config.windowMs;
            break;
          }
        }
        retryAfterMs = Math.max(1, dropTargetTime - nowMs);
      }
    }

    return {
      decision: {
        allowed,
        limit: config.limit,
        remaining,
        resetAtMs,
        retryAfterMs,
        degraded: false,
      },
      nextState: {
        logs: nextLogs,
      },
    };
  },

  peek(
    state: SlidingWindowLogState | undefined,
    config: SlidingWindowLogConfig,
    nowMs: number,
  ): Decision {
    const latestTimestamp = state && state.logs.length > 0 ? state.logs[state.logs.length - 1]!.timestamp : 0;
    const effectiveNow = Math.max(nowMs, latestTimestamp);

    const thresholdMs = effectiveNow - config.windowMs;
    const activeLogs = pruneLogs(state?.logs, thresholdMs);
    const currentCount = sumCost(activeLogs);

    const allowed = currentCount + 1 <= config.limit;
    const remaining = config.limit - currentCount;
    const newestTimestamp = activeLogs.length > 0 ? activeLogs[activeLogs.length - 1]!.timestamp : effectiveNow;
    const resetAtMs = newestTimestamp + config.windowMs;

    let retryAfterMs = 0;
    if (!allowed) {
      const neededToDrop = currentCount + 1 - config.limit;
      let accumulatedDropped = 0;
      let dropTargetTime = effectiveNow + config.windowMs;

      for (let i = 0; i < activeLogs.length; i++) {
        accumulatedDropped += activeLogs[i]!.cost;
        if (accumulatedDropped >= neededToDrop) {
          dropTargetTime = activeLogs[i]!.timestamp + config.windowMs;
          break;
        }
      }
      retryAfterMs = Math.max(1, dropTargetTime - nowMs);
    }

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAtMs,
      retryAfterMs,
      degraded: false,
    };
  },

  stateTtlMs(config: SlidingWindowLogConfig): number {
    return config.windowMs;
  },
};
