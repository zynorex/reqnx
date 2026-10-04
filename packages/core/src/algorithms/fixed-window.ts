// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Fixed Window Counter Algorithm
//
// Divides time into non-overlapping, epoch-aligned windows of `windowMs`
// milliseconds. Each window allows up to `max` requests. When the window
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
 * const config: FixedWindowInput = { max: 100, window: '1m' };
 * ```
 */
export interface FixedWindowInput {
  /** Maximum number of requests allowed per window. Must be a positive integer. */
  readonly max: number;
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
  /** Maximum requests per window. Positive integer. */
  readonly max: number;
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
 * @internal
 */
function alignedWindowStart(nowMs: number, windowMs: number): number {
  return nowMs - (nowMs % windowMs);
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
    // Per ADR-0002: never reset early on backwards clock.
    return { windowStart: state.windowStart, count: state.count };
  }

  // Time advanced past stored window: fresh window
  return { windowStart: currentWindowStart, count: 0 };
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

/**
 * Fixed Window Counter rate-limiting algorithm.
 *
 * ### Semantics
 * - Windows are **epoch-aligned**: `windowStart = nowMs - (nowMs % windowMs)`.
 *   All clients sharing the same key see identical window boundaries.
 * - The counter **always increments**, even on denied requests, preventing
 *   probing attacks from observing remaining count without cost.
 * - When the clock moves backwards (NTP corrections), the algorithm clamps
 *   to the stored window and never resets early (ADR-0002 monotonicity).
 *
 * ### Decision field semantics
 * | Field          | Meaning                                       |
 * |----------------|-----------------------------------------------|
 * | `remaining`    | Tokens left in the current window              |
 * | `resetAtMs`    | Epoch ms when the current window closes        |
 * | `retryAfterMs` | 0 if allowed; ms until window resets if denied |
 *
 * @example
 * ```ts
 * import { createLimiter, createMemoryStore } from '@reqnx/core';
 * import { fixedWindow } from '@reqnx/core/algorithms';
 *
 * const limiter = createLimiter({
 *   algorithm: fixedWindow,
 *   store: createMemoryStore(),
 *   prefix: 'api',
 *   config: { max: 100, window: '1m' },
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
    if (!input || typeof input !== 'object') {
      throw new ConfigError('Fixed window config must be an object.');
    }

    const raw = input as Record<string, unknown>;

    // Validate max
    const max = raw['max'];
    if (typeof max !== 'number' || !Number.isFinite(max) || !Number.isInteger(max) || max <= 0) {
      throw new ConfigError(
        `Fixed window \`max\` must be a positive integer, got ${String(max)}.`,
      );
    }

    // Validate window
    const window = raw['window'];
    if (window === undefined || window === null) {
      throw new ConfigError('Fixed window `window` is required.');
    }

    const windowMs = parseDuration(window as Duration);

    return { max, windowMs };
  },

  step(
    state: FixedWindowState | undefined,
    config: FixedWindowConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: FixedWindowState } {
    const { windowStart, count } = resolveWindow(state, nowMs, config.windowMs);

    const newCount = count + cost;
    const allowed = newCount <= config.max;
    const remaining = Math.max(0, config.max - newCount);
    const windowEnd = windowStart + config.windowMs;
    const retryAfterMs = allowed ? 0 : Math.max(0, windowEnd - nowMs);

    return {
      decision: {
        allowed,
        limit: config.max,
        remaining,
        resetAtMs: windowEnd,
        retryAfterMs,
        degraded: false,
      },
      nextState: {
        windowStart,
        count: newCount,
      },
    };
  },

  peek(
    state: FixedWindowState | undefined,
    config: FixedWindowConfig,
    nowMs: number,
  ): Decision {
    const { windowStart, count } = resolveWindow(state, nowMs, config.windowMs);

    const allowed = count < config.max;
    const remaining = Math.max(0, config.max - count);
    const windowEnd = windowStart + config.windowMs;
    const retryAfterMs = allowed ? 0 : Math.max(0, windowEnd - nowMs);

    return {
      allowed,
      limit: config.max,
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
