// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Sliding Window Counter Tests
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { slidingWindowCounter, ConfigError } from '../index.js';

describe('slidingWindowCounter', () => {
  describe('parseConfig', () => {
    it('parses valid config with numeric and string duration', () => {
      const c1 = slidingWindowCounter.parseConfig({ limit: 10, window: 60_000 });
      expect(c1).toEqual({ limit: 10, windowMs: 60_000 });

      const c2 = slidingWindowCounter.parseConfig({ limit: 100, window: '1m' });
      expect(c2).toEqual({ limit: 100, windowMs: 60_000 });
    });

    it('rejects invalid inputs', () => {
      expect(() => slidingWindowCounter.parseConfig(null)).toThrow(ConfigError);
      expect(() => slidingWindowCounter.parseConfig({ limit: 0, window: '1s' })).toThrow(ConfigError);
      expect(() => slidingWindowCounter.parseConfig({ limit: 10 })).toThrow(ConfigError);
      expect(() => slidingWindowCounter.parseConfig({ window: '1s' })).toThrow(ConfigError);
      expect(() => slidingWindowCounter.parseConfig({ limit: 10, window: '1s', extra: true })).toThrow(ConfigError);
    });
  });

  describe('step & peek', () => {
    const config = slidingWindowCounter.parseConfig({ limit: 10, window: '10s' });

    it('starts fresh with full capacity', () => {
      const now = 10_000;
      const peek = slidingWindowCounter.peek(undefined, config, now);
      expect(peek.allowed).toBe(true);
      expect(peek.remaining).toBe(10);

      const { decision, nextState } = slidingWindowCounter.step(undefined, config, now, 4);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(6);
      expect(decision.resetAtMs).toBe(20_000);
      expect(nextState).toEqual({
        currentWindowStart: 10_000,
        currentCount: 4,
        previousCount: 0,
      });
    });

    it('weights previous window count across boundary', () => {
      // In window [0, 10_000], consume 8 tokens
      let state: any = undefined;
      const c1 = slidingWindowCounter.step(state, config, 5_000, 8);
      state = c1.nextState;

      // In window [10_000, 20_000] at 12_500 (25% elapsed):
      // previous weight: (10_000 - 2_500) / 10_000 = 75%
      // scaledPrevious: floor(8 * 0.75) = 6
      // available: 10 - 6 = 4 tokens
      const c2 = slidingWindowCounter.step(state, config, 12_500, 3);
      expect(c2.decision.allowed).toBe(true);
      expect(c2.decision.remaining).toBe(1); // 10 - (6 + 3) = 1
      state = c2.nextState;

      // Now currentCount is 3, previousCount is 8.
      // At 15_000 (50% elapsed):
      // scaledPrevious: floor(8 * 0.5) = 4
      // estimated: 4 + 3 = 7 -> remaining: 3
      const peek = slidingWindowCounter.peek(state, config, 15_000);
      expect(peek.remaining).toBe(3);
    });

    it('maintains monotonicity under backwards clock jump', () => {
      let state: any = undefined;
      const c1 = slidingWindowCounter.step(state, config, 10_000, 3);
      state = c1.nextState;

      // Clock moves backwards
      const c2 = slidingWindowCounter.step(state, config, 9_500, 2);
      expect(c2.decision.allowed).toBe(true);
      expect(c2.nextState.currentWindowStart).toBe(10_000);
      expect(c2.nextState.currentCount).toBe(5);
    });
  });
});
