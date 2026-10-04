// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Lightweight browser FakeClock
//
// Implements the Clock interface from @reqnx/core for in-browser demos.
// This is a ~15-line reimplementation rather than importing from @reqnx/testkit
// (which is private and test-only). See ADR-0012.
// ──────────────────────────────────────────────────────────────────────────────

import type { Clock } from '@reqnx/core';

/**
 * A deterministic, manually-advanced clock for browser demos.
 *
 * Does NOT use `Date.now()` or any timers. Time advances only when
 * `advance()` is called explicitly by the scenario engine.
 */
export interface BrowserFakeClock extends Clock {
  /** Current simulated time in epoch milliseconds. */
  nowMs(): number;
  /** Advance the clock by `ms` milliseconds. */
  advance(ms: number): void;
  /** Reset the clock to the initial time. */
  reset(): void;
}

/**
 * Create a fake clock starting at `startMs` (default: 0).
 */
export function createBrowserFakeClock(startMs: number = 0): BrowserFakeClock {
  let currentMs = startMs;

  return {
    nowMs(): number {
      return currentMs;
    },

    advance(ms: number): void {
      if (ms < 0) throw new Error('Cannot advance clock by negative milliseconds');
      currentMs += ms;
    },

    reset(): void {
      currentMs = startMs;
    },
  };
}
