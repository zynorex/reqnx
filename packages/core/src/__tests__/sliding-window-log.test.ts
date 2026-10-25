// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Sliding Window Log Tests
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { slidingWindowLog, ConfigError } from '../index.js';

describe('slidingWindowLog', () => {
  describe('parseConfig', () => {
    it('parses valid config with numeric and string duration', () => {
      const c1 = slidingWindowLog.parseConfig({ limit: 10, window: 60_000 });
      expect(c1).toEqual({ limit: 10, windowMs: 60_000 });

      const c2 = slidingWindowLog.parseConfig({ limit: 100, window: '1m' });
      expect(c2).toEqual({ limit: 100, windowMs: 60_000 });
    });

    it('rejects invalid inputs', () => {
      expect(() => slidingWindowLog.parseConfig(null)).toThrow(ConfigError);
      expect(() => slidingWindowLog.parseConfig({ limit: 0, window: '1s' })).toThrow(ConfigError);
      expect(() => slidingWindowLog.parseConfig({ limit: 10 })).toThrow(ConfigError);
      expect(() => slidingWindowLog.parseConfig({ window: '1s' })).toThrow(ConfigError);
      expect(() => slidingWindowLog.parseConfig({ limit: 10, window: '1s', extra: true })).toThrow(ConfigError);
    });
  });

  describe('step & peek', () => {
    const config = slidingWindowLog.parseConfig({ limit: 5, window: '10s' });

    it('starts fresh with full capacity', () => {
      const now = 10_000;
      const peek = slidingWindowLog.peek(undefined, config, now);
      expect(peek.allowed).toBe(true);
      expect(peek.remaining).toBe(5);

      const { decision, nextState } = slidingWindowLog.step(undefined, config, now, 2);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(3);
      expect(decision.retryAfterMs).toBe(0);
      expect(nextState.logs).toEqual([{ timestamp: 10_000, cost: 2 }]);
    });

    it('enforces limit across sliding window', () => {
      let state: ReturnType<typeof slidingWindowLog.step>['nextState'] | undefined = undefined;
      const c1 = slidingWindowLog.step(state, config, 1_000, 3);
      state = c1.nextState;
      expect(c1.decision.allowed).toBe(true);
      expect(c1.decision.remaining).toBe(2);

      const c2 = slidingWindowLog.step(state, config, 2_000, 2);
      state = c2.nextState;
      expect(c2.decision.allowed).toBe(true);
      expect(c2.decision.remaining).toBe(0);

      // Denied at 3_000
      const c3 = slidingWindowLog.step(state, config, 3_000, 1);
      expect(c3.decision.allowed).toBe(false);
      expect(c3.decision.remaining).toBe(0);
      expect(c3.decision.retryAfterMs).toBe(8_000); // 1_000 + 10_000 - 3_000 = 8_000

      // At 11_001, first entry (at 1_000) expires -> 3 tokens free up!
      const c4 = slidingWindowLog.step(state, config, 11_001, 2);
      expect(c4.decision.allowed).toBe(true);
      expect(c4.decision.remaining).toBe(1);
    });

    it('maintains monotonicity under backwards clock jump', () => {
      let state: ReturnType<typeof slidingWindowLog.step>['nextState'] | undefined = undefined;
      const c1 = slidingWindowLog.step(state, config, 10_000, 2);
      state = c1.nextState;

      // Clock moves backwards by 500ms
      const c2 = slidingWindowLog.step(state, config, 9_500, 1);
      expect(c2.decision.allowed).toBe(true);
      expect(c2.decision.remaining).toBe(2);
      // New entry clamped to 10_000
      expect(c2.nextState.logs[1]!.timestamp).toBe(10_000);
    });
  });
});
