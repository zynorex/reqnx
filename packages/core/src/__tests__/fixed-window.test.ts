// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Fixed Window Algorithm Tests
//
// Unit tests, golden examples, config validation matrix, purity, TTL invariant,
// model-based naive oracle test, property-based tests (fast-check), boundary burst,
// and end-to-end limiter integration tests.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  fixedWindow,
  type FixedWindowConfig,
  type FixedWindowState,
} from '../algorithms/fixed-window.js';
import { createMemoryStore } from '../memory-store.js';
import { createLimiter } from '../limiter.js';
import { ConfigError } from '../errors.js';
import { createTestClock } from './test-helpers.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultConfig: FixedWindowConfig = { limit: 5, windowMs: 60_000 };

function stepN(
  config: FixedWindowConfig,
  n: number,
  startMs: number,
  cost = 1,
): { decision: ReturnType<typeof fixedWindow.step>['decision']; state: FixedWindowState } {
  let state: FixedWindowState | undefined;
  let lastDecision: ReturnType<typeof fixedWindow.step>['decision'] | undefined;

  for (let i = 0; i < n; i++) {
    const result = fixedWindow.step(state, config, startMs, cost);
    state = result.nextState;
    lastDecision = result.decision;
  }

  return { decision: lastDecision!, state: state! };
}

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('fixedWindow algorithm — Unit Tests', () => {
  describe('Golden Examples', () => {
    it('limit 3, window 1000 ms, all cost 1: exact step-by-step numbers', () => {
      const config: FixedWindowConfig = { limit: 3, windowMs: 1000 };
      let state: FixedWindowState | undefined;

      // t=0: allowed, remaining 2, resetAt 1000, retryAfter 0
      let r = fixedWindow.step(state, config, 0, 1);
      state = r.nextState;
      expect(r.decision).toEqual({
        allowed: true,
        limit: 3,
        remaining: 2,
        resetAtMs: 1000,
        retryAfterMs: 0,
        degraded: false,
      });

      // t=10: allowed, remaining 1
      r = fixedWindow.step(state, config, 10, 1);
      state = r.nextState;
      expect(r.decision).toEqual({
        allowed: true,
        limit: 3,
        remaining: 1,
        resetAtMs: 1000,
        retryAfterMs: 0,
        degraded: false,
      });

      // t=20: allowed, remaining 0
      r = fixedWindow.step(state, config, 20, 1);
      state = r.nextState;
      expect(r.decision).toEqual({
        allowed: true,
        limit: 3,
        remaining: 0,
        resetAtMs: 1000,
        retryAfterMs: 0,
        degraded: false,
      });

      // t=30: denied, remaining 0, resetAt 1000, retryAfter 970
      r = fixedWindow.step(state, config, 30, 1);
      state = r.nextState;
      expect(r.decision).toEqual({
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAtMs: 1000,
        retryAfterMs: 970,
        degraded: false,
      });
      // Crucial: count did not increment on denial
      expect(state.count).toBe(3);

      // t=999: denied, remaining 0, retryAfter 1
      r = fixedWindow.step(state, config, 999, 1);
      state = r.nextState;
      expect(r.decision).toEqual({
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAtMs: 1000,
        retryAfterMs: 1,
        degraded: false,
      });
      expect(state.count).toBe(3);

      // t=1000: allowed, remaining 2, resetAt 2000 (new window)
      r = fixedWindow.step(state, config, 1000, 1);
      state = r.nextState;
      expect(r.decision).toEqual({
        allowed: true,
        limit: 3,
        remaining: 2,
        resetAtMs: 2000,
        retryAfterMs: 0,
        degraded: false,
      });
      expect(state.windowStart).toBe(1000);
      expect(state.count).toBe(1);
    });

    it('Alignment: first request ever at t=1500 gets resetAt 2000, not 2500', () => {
      const config: FixedWindowConfig = { limit: 10, windowMs: 1000 };
      const r = fixedWindow.step(undefined, config, 1500, 1);
      expect(r.decision.resetAtMs).toBe(2000);
      expect(r.nextState.windowStart).toBe(1000);
    });

    it('Skipped windows: count 1 at t=0, next request at t=5000 starts fresh window at 5000', () => {
      const config: FixedWindowConfig = { limit: 10, windowMs: 1000 };
      const r1 = fixedWindow.step(undefined, config, 0, 1);
      expect(r1.nextState.count).toBe(1);

      const r2 = fixedWindow.step(r1.nextState, config, 5000, 1);
      expect(r2.nextState.windowStart).toBe(5000);
      expect(r2.nextState.count).toBe(1);
      expect(r2.decision.remaining).toBe(9);
      expect(r2.decision.resetAtMs).toBe(6000);
    });

    it('Cost: limit 5: t=0 cost 3 allowed, t=1 cost 3 denied (no consume), t=2 cost 2 allowed', () => {
      const config: FixedWindowConfig = { limit: 5, windowMs: 1000 };
      let state: FixedWindowState | undefined;

      // t=0 cost 3 allowed (remaining 2)
      let r = fixedWindow.step(state, config, 0, 3);
      state = r.nextState;
      expect(r.decision.allowed).toBe(true);
      expect(r.decision.remaining).toBe(2);
      expect(state.count).toBe(3);

      // t=1 cost 3 denied (remaining still 2, retryAfter 999)
      r = fixedWindow.step(state, config, 1, 3);
      state = r.nextState;
      expect(r.decision.allowed).toBe(false);
      expect(r.decision.remaining).toBe(2);
      expect(r.decision.retryAfterMs).toBe(999);
      // Denied requests MUST NOT consume tokens
      expect(state.count).toBe(3);

      // t=2 cost 2 allowed (remaining 0)
      r = fixedWindow.step(state, config, 2, 2);
      state = r.nextState;
      expect(r.decision.allowed).toBe(true);
      expect(r.decision.remaining).toBe(0);
      expect(state.count).toBe(5);
    });

    it('Backwards clock: with limit 3, window [1000,2000) has count 1; request at t=500 treated inside stored window', () => {
      const config: FixedWindowConfig = { limit: 3, windowMs: 1000 };
      const r1 = fixedWindow.step(undefined, config, 1200, 1);
      expect(r1.nextState.windowStart).toBe(1000);
      expect(r1.nextState.count).toBe(1);

      // Backwards clock to t=500: clamps to stored window [1000, 2000)
      const r2 = fixedWindow.step(r1.nextState, config, 500, 1);
      expect(r2.decision.allowed).toBe(true);
      expect(r2.nextState.windowStart).toBe(1000);
      expect(r2.nextState.count).toBe(2);
      expect(r2.decision.remaining).toBe(1);
      expect(r2.decision.resetAtMs).toBe(2000);
    });

    it('Huge cost (Number.MAX_SAFE_INTEGER): denied immediately with no precision glitch and no state change', () => {
      const config: FixedWindowConfig = { limit: 5, windowMs: 1000 };
      const r1 = fixedWindow.step(undefined, config, 100, 2);
      expect(r1.decision.allowed).toBe(true);
      expect(r1.nextState.count).toBe(2);

      const r2 = fixedWindow.step(r1.nextState, config, 200, Number.MAX_SAFE_INTEGER);
      expect(r2.decision.allowed).toBe(false);
      expect(r2.decision.remaining).toBe(3);
      expect(r2.nextState.count).toBe(2);
    });
  });

  describe('Edge cases and boundary semantics', () => {
    it('first request: allowed with remaining = limit - cost', () => {
      const res = fixedWindow.step(undefined, defaultConfig, 1000, 1);
      expect(res.decision.allowed).toBe(true);
      expect(res.decision.remaining).toBe(4);
      expect(res.decision.limit).toBe(5);
      expect(res.decision.retryAfterMs).toBe(0);
      expect(res.decision.degraded).toBe(false);
      expect(res.nextState).toEqual({ windowStart: 0, count: 1 });
    });

    it('exhausts limit exactly: admits up to limit, denies the next', () => {
      const { decision, state } = stepN(defaultConfig, 5, 1000);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(0);
      expect(state.count).toBe(5);

      const next = fixedWindow.step(state, defaultConfig, 1000, 1);
      expect(next.decision.allowed).toBe(false);
      expect(next.decision.remaining).toBe(0);
      expect(next.decision.retryAfterMs).toBe(60_000 - 1000);
      expect(next.nextState.count).toBe(5);
    });

    it('works with limit = 1', () => {
      const config: FixedWindowConfig = { limit: 1, windowMs: 1000 };
      const r1 = fixedWindow.step(undefined, config, 100, 1);
      expect(r1.decision.allowed).toBe(true);
      expect(r1.decision.remaining).toBe(0);

      const r2 = fixedWindow.step(r1.nextState, config, 200, 1);
      expect(r2.decision.allowed).toBe(false);
      expect(r2.decision.remaining).toBe(0);
    });

    it('works with window = 1 ms', () => {
      const config: FixedWindowConfig = { limit: 2, windowMs: 1 };
      const r1 = fixedWindow.step(undefined, config, 10, 1);
      expect(r1.decision.allowed).toBe(true);
      expect(r1.decision.resetAtMs).toBe(11);

      const r2 = fixedWindow.step(r1.nextState, config, 10, 1);
      expect(r2.decision.allowed).toBe(true);
      expect(r2.decision.remaining).toBe(0);

      const r3 = fixedWindow.step(r2.nextState, config, 10, 1);
      expect(r3.decision.allowed).toBe(false);

      // t=11 is a new window
      const r4 = fixedWindow.step(r3.nextState, config, 11, 1);
      expect(r4.decision.allowed).toBe(true);
      expect(r4.decision.resetAtMs).toBe(12);
    });

    it('rollover at boundary - 1 vs boundary', () => {
      const config: FixedWindowConfig = { limit: 2, windowMs: 1000 };
      // Window is [0, 1000)
      const r1 = fixedWindow.step(undefined, config, 0, 2);
      expect(r1.decision.allowed).toBe(true);
      expect(r1.decision.remaining).toBe(0);

      // At boundary - 1 (t=999): still in same window, denied
      const r2 = fixedWindow.step(r1.nextState, config, 999, 1);
      expect(r2.decision.allowed).toBe(false);
      expect(r2.decision.retryAfterMs).toBe(1);

      // At boundary (t=1000): new window [1000, 2000), allowed
      const r3 = fixedWindow.step(r2.nextState, config, 1000, 1);
      expect(r3.decision.allowed).toBe(true);
      expect(r3.decision.remaining).toBe(1);
      expect(r3.decision.resetAtMs).toBe(2000);
    });

    it('cost > limit denies on fresh state without changing count', () => {
      const config: FixedWindowConfig = { limit: 3, windowMs: 1000 };
      const r = fixedWindow.step(undefined, config, 500, 4);
      expect(r.decision.allowed).toBe(false);
      expect(r.decision.remaining).toBe(3);
      expect(r.nextState.count).toBe(0);
    });

    it('retryAfterMs is at least 1 when denied', () => {
      const config: FixedWindowConfig = { limit: 1, windowMs: 1000 };
      const r1 = fixedWindow.step(undefined, config, 0, 1);
      expect(r1.decision.allowed).toBe(true);

      const r2 = fixedWindow.step(r1.nextState, config, 999, 1);
      expect(r2.decision.allowed).toBe(false);
      expect(r2.decision.retryAfterMs).toBe(1);
    });
  });

  describe('peek()', () => {
    it('peek does not consume capacity and reflects current quota', () => {
      const config: FixedWindowConfig = { limit: 5, windowMs: 1000 };
      const r1 = fixedWindow.step(undefined, config, 100, 2);
      expect(r1.nextState.count).toBe(2);

      const peek1 = fixedWindow.peek(r1.nextState, config, 200);
      expect(peek1.allowed).toBe(true);
      expect(peek1.remaining).toBe(3);
      expect(peek1.limit).toBe(5);
      expect(peek1.resetAtMs).toBe(1000);
      expect(peek1.retryAfterMs).toBe(0);

      // Second peek is identical
      const peek2 = fixedWindow.peek(r1.nextState, config, 200);
      expect(peek2).toEqual(peek1);
    });

    it('peek on undefined state reflects full capacity', () => {
      const config: FixedWindowConfig = { limit: 5, windowMs: 1000 };
      const peek = fixedWindow.peek(undefined, config, 1500);
      expect(peek.allowed).toBe(true);
      expect(peek.remaining).toBe(5);
      expect(peek.resetAtMs).toBe(2000);
      expect(peek.retryAfterMs).toBe(0);
    });

    it('peek on exhausted state reports allowed: false with retryAfterMs >= 1', () => {
      const config: FixedWindowConfig = { limit: 1, windowMs: 1000 };
      const r = fixedWindow.step(undefined, config, 500, 1);
      const peek = fixedWindow.peek(r.nextState, config, 600);
      expect(peek.allowed).toBe(false);
      expect(peek.remaining).toBe(0);
      expect(peek.retryAfterMs).toBe(400);
    });
  });

  describe('Purity and Invariants', () => {
    it('frozen input state is never mutated', () => {
      const config: FixedWindowConfig = { limit: 5, windowMs: 1000 };
      const state: FixedWindowState = Object.freeze({ windowStart: 1000, count: 2 });
      expect(() => {
        fixedWindow.step(state, config, 1500, 1);
      }).not.toThrow();
      expect(state.count).toBe(2);
      expect(state.windowStart).toBe(1000);
    });

    it('identical inputs produce identical outputs (pure function)', () => {
      const config: FixedWindowConfig = { limit: 5, windowMs: 1000 };
      const state: FixedWindowState = { windowStart: 1000, count: 2 };
      const out1 = fixedWindow.step(state, config, 1200, 2);
      const out2 = fixedWindow.step(state, config, 1200, 2);
      expect(out1).toEqual(out2);
    });

    it('stateTtlMs satisfies the TTL invariant', () => {
      const config: FixedWindowConfig = { limit: 10, windowMs: 30_000 };
      expect(fixedWindow.stateTtlMs(config)).toBe(30_000);
      // TTL equals windowMs: ensures state written at any point in a window
      // lives long enough to cover the window, and expires after 1 window.
    });
  });

  describe('Config Validation Matrix', () => {
    it('accepts valid config with numbers or string duration', () => {
      expect(fixedWindow.parseConfig({ limit: 10, window: '1m' })).toEqual({
        limit: 10,
        windowMs: 60_000,
      });
      expect(fixedWindow.parseConfig({ limit: 100, window: 5000 })).toEqual({
        limit: 100,
        windowMs: 5000,
      });
    });

    it('rejects non-object inputs', () => {
      expect(() => fixedWindow.parseConfig(null)).toThrow(ConfigError);
      expect(() => fixedWindow.parseConfig(undefined)).toThrow(ConfigError);
      expect(() => fixedWindow.parseConfig('string')).toThrow(ConfigError);
      expect(() => fixedWindow.parseConfig(123)).toThrow(ConfigError);
      expect(() => fixedWindow.parseConfig([])).toThrow(ConfigError);
    });

    it('rejects unknown / extra keys and lists allowed keys', () => {
      try {
        fixedWindow.parseConfig({ limit: 10, window: '1m', extra: 'bad' });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as Error).message).toContain('Unknown config key(s): extra');
        expect((err as Error).message).toContain('Allowed keys are: limit, window');
      }
    });

    it('rejects missing limit or window', () => {
      expect(() => fixedWindow.parseConfig({ window: '1m' })).toThrow(ConfigError);
      expect(() => fixedWindow.parseConfig({ limit: 10 })).toThrow(ConfigError);
    });

    it('rejects invalid limit values (0, negative, float, NaN, Infinity, > 2^31 - 1)', () => {
      const invalidLimits = [0, -1, 1.5, NaN, Infinity, -Infinity, '10', null, 2_147_483_648];
      for (const val of invalidLimits) {
        expect(() => fixedWindow.parseConfig({ limit: val, window: '1m' })).toThrow(ConfigError);
      }
    });

    it('rejects invalid window values via parseDuration', () => {
      const invalidWindows = [0, -100, '0s', '-5s', 'invalid', NaN, Infinity];
      for (const val of invalidWindows) {
        expect(() => fixedWindow.parseConfig({ limit: 10, window: val })).toThrow();
      }
    });
  });

  describe('BOUNDARY BURST test', () => {
    it('documents intended behaviour: boundary burst admits 2x limit within 2 ms', () => {
      // With limit L and window W: L requests at W-1 and L at W are ALL admitted (2L within 2 ms),
      // and the next one is denied.
      const L = 50;
      const W = 1000;
      const config: FixedWindowConfig = { limit: L, windowMs: W };

      let state: FixedWindowState | undefined;

      // Burst 1: L requests at W - 1 (t=999)
      for (let i = 0; i < L; i++) {
        const r = fixedWindow.step(state, config, W - 1, 1);
        expect(r.decision.allowed).toBe(true);
        state = r.nextState;
      }
      expect(state!.count).toBe(L);

      // Next request at W - 1 is denied
      const deniedAt999 = fixedWindow.step(state, config, W - 1, 1);
      expect(deniedAt999.decision.allowed).toBe(false);

      // Burst 2: L requests at W (t=1000) — brand new window!
      for (let i = 0; i < L; i++) {
        const r = fixedWindow.step(state, config, W, 1);
        expect(r.decision.allowed).toBe(true);
        state = r.nextState;
      }
      expect(state!.count).toBe(L);

      // In total: 2 * L = 100 requests were admitted between t=999 and t=1000 (span of 1 ms)!
      // The (2L + 1)th request at t=1000 is denied
      const deniedAt1000 = fixedWindow.step(state, config, W, 1);
      expect(deniedAt1000.decision.allowed).toBe(false);
      expect(deniedAt1000.decision.remaining).toBe(0);
    });
  });
});

// ─── Model-Based Test (Independent Naive Oracle) ──────────────────────────────

describe('fixedWindow algorithm — Model-based Oracle Test', () => {
  interface NaiveOracleWindow {
    admittedCost: number;
  }

  class NaiveOracle {
    private readonly limit: number;
    private readonly windowMs: number;
    private windows = new Map<number, NaiveOracleWindow>();
    private lastWindowStart = -1;

    constructor(limit: number, windowMs: number) {
      this.limit = limit;
      this.windowMs = windowMs;
    }

    step(
      nowMs: number,
      cost: number,
    ): { allowed: boolean; remaining: number; resetAtMs: number; retryAfterMs: number } {
      let winStart = Math.floor(nowMs / this.windowMs) * this.windowMs;

      // Backwards clock clamp
      if (winStart < this.lastWindowStart) {
        winStart = this.lastWindowStart;
      } else {
        this.lastWindowStart = winStart;
      }

      let win = this.windows.get(winStart);
      if (!win) {
        win = { admittedCost: 0 };
        this.windows.set(winStart, win);
      }

      const allowed = win.admittedCost + cost <= this.limit;
      if (allowed) {
        win.admittedCost += cost;
      }

      const remaining = this.limit - win.admittedCost;
      const resetAtMs = winStart + this.windowMs;
      const retryAfterMs = allowed ? 0 : Math.max(1, resetAtMs - nowMs);

      return { allowed, remaining, resetAtMs, retryAfterMs };
    }
  }

  it('matches naive oracle across random request sequences (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // limit
        fc.integer({ min: 10, max: 10_000 }), // windowMs
        fc.array(
          fc.record({
            gapMs: fc.integer({ min: 0, max: 5000 }),
            cost: fc.integer({ min: 1, max: 20 }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (limit, windowMs, requests) => {
          const config: FixedWindowConfig = { limit, windowMs };
          const oracle = new NaiveOracle(limit, windowMs);
          let state: FixedWindowState | undefined;
          let currentMs = 1_000_000;

          for (const req of requests) {
            currentMs += req.gapMs;
            const expected = oracle.step(currentMs, req.cost);
            const actual = fixedWindow.step(state, config, currentMs, req.cost);
            state = actual.nextState;

            expect(actual.decision.allowed).toBe(expected.allowed);
            expect(actual.decision.remaining).toBe(expected.remaining);
            expect(actual.decision.resetAtMs).toBe(expected.resetAtMs);
            expect(actual.decision.retryAfterMs).toBe(expected.retryAfterMs);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property-Based Tests (fast-check) ─────────────────────────────────────────

describe('fixedWindow algorithm — Property-Based Tests', () => {
  const configArb = fc.record({
    limit: fc.integer({ min: 1, max: 1000 }),
    windowMs: fc.integer({ min: 1, max: 3_600_000 }),
  });
  const nowArb = fc.integer({ min: 0, max: 1_000_000_000 });
  const costArb = fc.integer({ min: 1, max: 100 });

  it('Property 1: Per aligned window, admitted cost never exceeds limit', () => {
    fc.assert(
      fc.property(
        configArb,
        nowArb,
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 50 }),
        (config, baseNow, costs) => {
          const winStart = Math.floor(baseNow / config.windowMs) * config.windowMs;
          let state: FixedWindowState | undefined;
          let totalAdmitted = 0;

          for (const cost of costs) {
            // All requests inside the same window [winStart, winStart + windowMs - 1]
            const nowMs = winStart + (baseNow % config.windowMs);
            const res = fixedWindow.step(state, config, nowMs, cost);
            state = res.nextState;
            if (res.decision.allowed) {
              totalAdmitted += cost;
            }
          }

          expect(totalAdmitted).toBeLessThanOrEqual(config.limit);
        },
      ),
    );
  });

  it('Property 2: In ANY half-open interval [t, t + windowMs), admitted cost is at most 2 * limit', () => {
    fc.assert(
      fc.property(
        configArb,
        nowArb,
        fc.array(
          fc.record({
            offsetMs: fc.integer({ min: 0, max: 10_000 }),
            cost: fc.integer({ min: 1, max: 20 }),
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (config, t, requests) => {
          // Sort requests by time to ensure non-decreasing sequence within [t, t + windowMs)
          const sorted = requests
            .map((r) => ({
              nowMs: t + (r.offsetMs % config.windowMs),
              cost: r.cost,
            }))
            .sort((a, b) => a.nowMs - b.nowMs);

          let state: FixedWindowState | undefined;
          let admittedInInterval = 0;

          for (const req of sorted) {
            const res = fixedWindow.step(state, config, req.nowMs, req.cost);
            state = res.nextState;
            if (res.decision.allowed) {
              admittedInInterval += req.cost;
            }
          }

          expect(admittedInInterval).toBeLessThanOrEqual(2 * config.limit);
        },
      ),
    );
  });

  it('Property 3: Invariant: remaining in [0, limit], retryAfterMs semantics, resetAtMs >= currentWindow + windowMs', () => {
    fc.assert(
      fc.property(configArb, nowArb, costArb, (config, nowMs, cost) => {
        const res = fixedWindow.step(undefined, config, nowMs, cost);
        expect(res.decision.remaining).toBeGreaterThanOrEqual(0);
        expect(res.decision.remaining).toBeLessThanOrEqual(config.limit);

        if (res.decision.allowed) {
          expect(res.decision.retryAfterMs).toBe(0);
        } else {
          expect(res.decision.retryAfterMs).toBeGreaterThanOrEqual(1);
        }

        const winStart = Math.floor(nowMs / config.windowMs) * config.windowMs;
        expect(res.decision.resetAtMs).toBe(winStart + config.windowMs);
      }),
    );
  });

  it('Property 4: peek followed by cost-1 step at same time matches semantics', () => {
    fc.assert(
      fc.property(configArb, nowArb, (config, nowMs) => {
        const peek = fixedWindow.peek(undefined, config, nowMs);
        const step = fixedWindow.step(undefined, config, nowMs, 1);

        expect(peek.allowed).toBe(step.decision.allowed);
        expect(peek.resetAtMs).toBe(step.decision.resetAtMs);
        expect(peek.retryAfterMs).toBe(step.decision.retryAfterMs);
        expect(peek.remaining).toBe(step.decision.remaining + (step.decision.allowed ? 1 : 0));
      }),
    );
  });

  it('Property 5: Backwards time: for any state and earlier now, outcomes equal outcome at stored window start', () => {
    fc.assert(
      fc.property(
        configArb,
        nowArb,
        costArb,
        fc.integer({ min: 1, max: 1_000_000 }),
        (config, futureNow, cost, backwardsDelta) => {
          // Initialize state at futureNow
          const r1 = fixedWindow.step(undefined, config, futureNow, 1);
          const pastNow = Math.max(0, futureNow - backwardsDelta);

          // If pastNow is in an earlier window than r1.nextState.windowStart
          const pastWinStart = Math.floor(pastNow / config.windowMs) * config.windowMs;
          if (pastWinStart < r1.nextState.windowStart) {
            const rBackwards = fixedWindow.step(r1.nextState, config, pastNow, cost);
            const rAtStored = fixedWindow.step(
              r1.nextState,
              config,
              r1.nextState.windowStart,
              cost,
            );

            expect(rBackwards.decision.allowed).toBe(rAtStored.decision.allowed);
            expect(rBackwards.decision.remaining).toBe(rAtStored.decision.remaining);
            expect(rBackwards.decision.resetAtMs).toBe(rAtStored.decision.resetAtMs);
          }
        },
      ),
    );
  });
});

// ─── End-to-End Limiter Integration Tests ─────────────────────────────────────

describe('fixedWindow + createLimiter + createMemoryStore Integration', () => {
  it('enforces limit 3 per 1s over several windows', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: fixedWindow,
      store,
      prefix: 'test',
      config: { limit: 3, window: '1s' },
    });

    // Window 1: [1000, 2000)
    expect((await limiter.check('user1')).allowed).toBe(true);
    expect((await limiter.check('user1')).allowed).toBe(true);
    expect((await limiter.check('user1')).allowed).toBe(true);
    const denied1 = await limiter.check('user1');
    expect(denied1.allowed).toBe(false);
    expect(denied1.retryAfterMs).toBe(1000); // 2000 - 1000

    // Advance 500ms -> T=1500 (still inside Window 1)
    clock.advance(500);
    const denied2 = await limiter.check('user1');
    expect(denied2.allowed).toBe(false);
    expect(denied2.retryAfterMs).toBe(500);

    // Advance 500ms -> T=2000 (Window 2: [2000, 3000))
    clock.advance(500);
    expect((await limiter.check('user1')).allowed).toBe(true);
  });

  it('guarantees per-key independence', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: fixedWindow,
      store,
      prefix: 'test',
      config: { limit: 2, window: '1s' },
    });

    // Exhaust userA
    await limiter.check('userA');
    await limiter.check('userA');
    expect((await limiter.check('userA')).allowed).toBe(false);

    // userB has full quota
    const resB = await limiter.check('userB');
    expect(resB.allowed).toBe(true);
    expect(resB.remaining).toBe(1);
  });

  it('handles state expiry gracefully', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: fixedWindow,
      store,
      prefix: 'test',
      config: { limit: 2, window: '1s' },
    });

    await limiter.check('user1');
    await limiter.check('user1');
    expect((await limiter.check('user1')).allowed).toBe(false);

    // Advance past TTL (1000ms windowMs)
    clock.advance(5000);
    const res = await limiter.check('user1');
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1);
  });

  it('concurrency test: 1,000 simultaneous check() calls with limit 100 admit exactly 100', async () => {
    const clock = createTestClock(10_000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: fixedWindow,
      store,
      prefix: 'test',
      config: { limit: 100, window: '1m' },
    });

    const promises: Array<ReturnType<typeof limiter.check>> = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(limiter.check('hotkey'));
    }

    const results = await Promise.all(promises);
    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;

    expect(allowed).toBe(100);
    expect(denied).toBe(900);
  });
});
