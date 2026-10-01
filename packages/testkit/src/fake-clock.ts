// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/testkit — FakeClock
//
// A deterministic clock for testing. Full implementation on Day 2.
// ──────────────────────────────────────────────────────────────────────────────

import { type Clock } from '@reqnx/core';

/**
 * A deterministic, manually-controlled clock for testing.
 *
 * Use `FakeClock` with `MemoryStore` to write tests that don't depend on
 * wall-clock time. Advance time explicitly via `advance()` or `set()`.
 *
 * @example
 * ```ts
 * const clock = new FakeClock(1000);
 * clock.nowMs(); // 1000
 * clock.advance(5000);
 * clock.nowMs(); // 6000
 * ```
 */
export class FakeClock implements Clock {
  private _nowMs: number;

  constructor(initialMs: number = 0) {
    this._nowMs = initialMs;
  }

  nowMs(): number {
    return this._nowMs;
  }

  /**
   * Advance the clock by the given number of milliseconds.
   * @param ms - Milliseconds to advance. Must be ≥ 0.
   */
  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('Cannot advance clock by a negative amount');
    }
    this._nowMs += ms;
  }

  /**
   * Set the clock to an exact epoch ms value.
   * @param ms - Epoch milliseconds.
   */
  set(ms: number): void {
    this._nowMs = ms;
  }
}
