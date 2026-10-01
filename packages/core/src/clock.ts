// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Clock
//
// The ONLY place Date.now() is permitted in @reqnx/core.
// ──────────────────────────────────────────────────────────────────────────────

import { type Clock } from './types.js';

/**
 * Default system clock backed by `Date.now()`.
 *
 * This is the **only** module in `@reqnx/core` that may call `Date.now()`.
 * All other modules must accept a {@link Clock} parameter.
 *
 * @example
 * ```ts
 * import { SystemClock } from '@reqnx/core';
 * const now = SystemClock.nowMs(); // same as Date.now()
 * ```
 */
export const SystemClock: Clock = {
  nowMs(): number {
    return Date.now();
  },
};
