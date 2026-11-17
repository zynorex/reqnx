// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Leaky Bucket Unit, Equivalence, Oracle, and Mutation Tests
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { ConfigError } from '../errors.js';
import {
  leakyBucket,
  type LeakyBucketConfig,
  type LeakyBucketInput,
  type LeakyBucketState,
} from '../algorithms/leaky-bucket.js';
import {
  tokenBucket,
  type TokenBucketState,
} from '../algorithms/token-bucket.js';

// ─── Independent Water-Model Oracle ───────────────────────────────────────────

/**
 * Independent water-model oracle simulating discrete ms-by-ms water accumulation and leaking.
 *
 * Implements pure water semantics:
 * - Bucket starts EMPTY (waterLevel = 0).
 * - Water leaks at `a` internal units per millisecond until `waterLevel = 0`.
 * - Requests add `cost * b` water.
 * - If `waterLevel + cost * b > capacityUnits`, request is denied and water level is unchanged.
 * - Room remaining = `floor((capacityUnits - waterLevel) / b)`.
 * - Time to empty = `ceil(waterLevel / a)` ms.
 * - Time to fit cost = `ceil((waterLevel + cost * b - capacityUnits) / a)` ms.
 */
class WaterModelOracle {
  public waterLevel: number; // in internal units [0, capacityUnits]
  public currentTimeMs: number;
  public readonly a: number;
  public readonly b: number;
  public readonly capacityUnits: number;
  public readonly capacity: number;

  constructor(config: LeakyBucketConfig, initialTimeMs = 0) {
    this.a = config.a;
    this.b = config.b;
    this.capacity = config.capacity;
    this.capacityUnits = config.capacityUnits;
    this.currentTimeMs = initialTimeMs;
    // Bucket starts completely empty
    this.waterLevel = 0;
  }

  public advanceTo(targetTimeMs: number): void {
    if (targetTimeMs <= this.currentTimeMs) {
      return;
    }
    while (this.currentTimeMs < targetTimeMs) {
      this.currentTimeMs++;
      this.waterLevel = Math.max(0, this.waterLevel - this.a);
    }
  }

  public step(cost: number): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAtMs: number;
    retryAfterMs: number;
  } {
    const room = this.capacityUnits - this.waterLevel;
    const remainingBefore = Math.floor(room / this.b);

    if (cost > this.capacity) {
      let simWater = this.waterLevel;
      let msToDrain = 0;
      while (simWater > 0) {
        msToDrain++;
        simWater = Math.max(0, simWater - this.a);
      }
      const fullDrainMs = Math.ceil(this.capacityUnits / this.a);
      return {
        allowed: false,
        limit: this.capacity,
        remaining: remainingBefore,
        resetAtMs: this.currentTimeMs + msToDrain,
        retryAfterMs: msToDrain > 0 ? msToDrain : fullDrainMs,
      };
    }

    const waterAdded = cost * this.b;
    const allowed = this.waterLevel + waterAdded <= this.capacityUnits;

    if (allowed) {
      this.waterLevel += waterAdded;
      const roomAfter = this.capacityUnits - this.waterLevel;
      const remainingAfter = Math.floor(roomAfter / this.b);

      let simWater = this.waterLevel;
      let msToDrain = 0;
      while (simWater > 0) {
        msToDrain++;
        simWater = Math.max(0, simWater - this.a);
      }
      return {
        allowed: true,
        limit: this.capacity,
        remaining: remainingAfter,
        resetAtMs: this.currentTimeMs + msToDrain,
        retryAfterMs: 0,
      };
    } else {
      let simWater = this.waterLevel;
      let msToDrain = 0;
      while (simWater > 0) {
        msToDrain++;
        simWater = Math.max(0, simWater - this.a);
      }

      // Time until enough water leaks to accommodate waterAdded
      const excessWater = this.waterLevel + waterAdded - this.capacityUnits;
      let simLeakWater = excessWater;
      let msToFit = 0;
      while (simLeakWater > 0) {
        msToFit++;
        simLeakWater = Math.max(0, simLeakWater - this.a);
      }

      return {
        allowed: false,
        limit: this.capacity,
        remaining: remainingBefore,
        resetAtMs: this.currentTimeMs + msToDrain,
        retryAfterMs: msToFit,
      };
    }
  }

  public peek(): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAtMs: number;
    retryAfterMs: number;
  } {
    const room = this.capacityUnits - this.waterLevel;
    const remaining = Math.floor(room / this.b);
    const need = this.b;
    const allowed = room >= need;

    let simWater = this.waterLevel;
    let msToDrain = 0;
    while (simWater > 0) {
      msToDrain++;
      simWater = Math.max(0, simWater - this.a);
    }

    let retryAfterMs = 0;
    if (!allowed) {
      const excess = need - room;
      let simLeak = excess;
      while (simLeak > 0) {
        retryAfterMs++;
        simLeak = Math.max(0, simLeak - this.a);
      }
    }

    return {
      allowed,
      limit: this.capacity,
      remaining,
      resetAtMs: this.currentTimeMs + msToDrain,
      retryAfterMs,
    };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('leakyBucket (meter)', () => {
  describe('Config Parsing and Validation', () => {
    it('accepts valid config with interval string', () => {
      const config = leakyBucket.parseConfig({
        capacity: 10,
        leak: 2,
        interval: '1s',
      });
      expect(config.capacity).toBe(10);
      expect(config.leak).toBe(2);
      expect(config.intervalMs).toBe(1000);
      expect(config.a).toBe(1);
      expect(config.b).toBe(500);
      expect(config.capacityUnits).toBe(5000);
      expect(config.drainTimeMs).toBe(5000);
    });

    it('accepts leakInterval as an alias for interval', () => {
      const config = leakyBucket.parseConfig({
        capacity: 5,
        leak: 1,
        leakInterval: '500ms',
      });
      expect(config.capacity).toBe(5);
      expect(config.leak).toBe(1);
      expect(config.intervalMs).toBe(500);
      expect(config.drainTimeMs).toBe(2500);
    });

    it('accepts both interval and leakInterval if they match', () => {
      const config = leakyBucket.parseConfig({
        capacity: 5,
        leak: 1,
        interval: '1s',
        leakInterval: 1000,
      });
      expect(config.intervalMs).toBe(1000);
    });

    it('rejects conflicting interval and leakInterval', () => {
      expect(() =>
        leakyBucket.parseConfig({
          capacity: 5,
          leak: 1,
          interval: '1s',
          leakInterval: '2s',
        }),
      ).toThrow(ConfigError);
    });

    it('rejects non-object or array input', () => {
      expect(() => leakyBucket.parseConfig(null)).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig(undefined)).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig([])).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig('config')).toThrow(ConfigError);
    });

    it('rejects unknown config keys', () => {
      expect(() =>
        leakyBucket.parseConfig({
          capacity: 10,
          leak: 1,
          interval: '1s',
          unknownKey: true,
        }),
      ).toThrow(ConfigError);
    });

    it('rejects missing required keys', () => {
      expect(() => leakyBucket.parseConfig({ leak: 1, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: 10, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: 10, leak: 1 })).toThrow(ConfigError);
    });

    it('rejects invalid capacity numbers', () => {
      expect(() => leakyBucket.parseConfig({ capacity: 0, leak: 1, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: -5, leak: 1, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: 1.5, leak: 1, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: Infinity, leak: 1, interval: '1s' })).toThrow(ConfigError);
    });

    it('rejects invalid leak numbers', () => {
      expect(() => leakyBucket.parseConfig({ capacity: 10, leak: 0, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: 10, leak: -1, interval: '1s' })).toThrow(ConfigError);
      expect(() => leakyBucket.parseConfig({ capacity: 10, leak: 2.5, interval: '1s' })).toThrow(ConfigError);
    });

    it('rejects capacityUnits exceeding MAX_CAPACITY_UNITS (2^51)', () => {
      // 2^31 - 1 capacity with prime/coprime duration of 1000000000ms
      expect(() =>
        leakyBucket.parseConfig({
          capacity: 2_000_000_000,
          leak: 1,
          interval: 2_000_000_000,
        }),
      ).toThrow('capacityUnits');
    });

    it('rejects full drain time exceeding MAX_DURATION_MS (366 days)', () => {
      expect(() =>
        leakyBucket.parseConfig({
          capacity: 2_000_000_000,
          leak: 1,
          interval: '1s',
        }),
      ).toThrow('full drain time');
    });
  });

  describe('Golden Examples & Baseline Semantics', () => {
    it('starts empty with all capacity available, admitting request up to capacity', () => {
      const config = leakyBucket.parseConfig({ capacity: 5, leak: 1, interval: '1s' });
      const now = 1000;

      // First request of cost 3 (empty bucket -> remaining before was 5, now 2)
      const res1 = leakyBucket.step(undefined, config, now, 3);
      expect(res1.decision).toEqual({
        allowed: true,
        limit: 5,
        remaining: 2,
        resetAtMs: 4000, // 3 units of water takes 3 seconds to drain
        retryAfterMs: 0,
        degraded: false,
      });

      // Second request at same time of cost 2 -> fills bucket completely (remaining 0)
      const res2 = leakyBucket.step(res1.nextState, config, now, 2);
      expect(res2.decision).toEqual({
        allowed: true,
        limit: 5,
        remaining: 0,
        resetAtMs: 6000, // 5 units of water takes 5s to drain
        retryAfterMs: 0,
        degraded: false,
      });

      // Third request at same time of cost 1 -> rejected (bucket is full)
      const res3 = leakyBucket.step(res2.nextState, config, now, 1);
      expect(res3.decision).toEqual({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAtMs: 6000,
        retryAfterMs: 1000, // 1 unit needs 1 second to leak out
        degraded: false,
      });
      // Denied requests do not modify state
      expect(res3.nextState).toEqual(res2.nextState);
    });

    it('continuous leak drains water over elapsed time', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 2, interval: '1s' });
      const now = 10_000;

      // Fill bucket to 10
      const res1 = leakyBucket.step(undefined, config, now, 10);
      expect(res1.decision.remaining).toBe(0);

      // Advance by 1.5s (1500ms): leaks 1.5 * 2 = 3 units -> remaining = 3
      const peekTime = now + 1500;
      const peekRes = leakyBucket.peek(res1.nextState, config, peekTime);
      expect(peekRes.remaining).toBe(3);
      expect(peekRes.allowed).toBe(true);

      // Consume 2 units -> remaining drops to 1
      const res2 = leakyBucket.step(res1.nextState, config, peekTime, 2);
      expect(res2.decision.allowed).toBe(true);
      expect(res2.decision.remaining).toBe(1);
    });

    it('rejects requests with cost exceeding capacity without altering state', () => {
      const config = leakyBucket.parseConfig({ capacity: 5, leak: 1, interval: '1s' });
      const now = 1000;
      const res = leakyBucket.step(undefined, config, now, 10);

      expect(res.decision.allowed).toBe(false);
      expect(res.decision.limit).toBe(5);
      expect(res.decision.remaining).toBe(5);
      expect(res.decision.retryAfterMs).toBe(5000);
    });
  });

  describe('Curve-1 Case: capacity 1, leak 1 per interval (Strict Rate Metering)', () => {
    it('admits at most 1 request per interval with no bursts permitted', () => {
      const config = leakyBucket.parseConfig({ capacity: 1, leak: 1, interval: '100ms' });
      const t0 = 10_000;

      // Request 1 admitted
      const r1 = leakyBucket.step(undefined, config, t0, 1);
      expect(r1.decision.allowed).toBe(true);
      expect(r1.decision.remaining).toBe(0);
      expect(r1.decision.resetAtMs).toBe(t0 + 100);
      expect(r1.decision.retryAfterMs).toBe(0);

      // Immediate request 2 denied (0ms elapsed)
      const r2 = leakyBucket.step(r1.nextState, config, t0, 1);
      expect(r2.decision.allowed).toBe(false);
      expect(r2.decision.remaining).toBe(0);
      expect(r2.decision.retryAfterMs).toBe(100);

      // At 50ms (halfway): still denied
      const r3 = leakyBucket.step(r1.nextState, config, t0 + 50, 1);
      expect(r3.decision.allowed).toBe(false);
      expect(r3.decision.remaining).toBe(0);
      expect(r3.decision.retryAfterMs).toBe(50);

      // At exactly 100ms: admitted!
      const r4 = leakyBucket.step(r1.nextState, config, t0 + 100, 1);
      expect(r4.decision.allowed).toBe(true);
      expect(r4.decision.remaining).toBe(0);
      expect(r4.decision.resetAtMs).toBe(t0 + 200);
    });
  });

  describe('TTL and Purity Invariants', () => {
    it('returns exact drainTimeMs for stateTtlMs', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 2, interval: '1s' });
      expect(leakyBucket.stateTtlMs(config)).toBe(5000);
      expect(leakyBucket.stateTtlMs(config)).toBe(config.drainTimeMs);
    });

    it('step and peek are strictly pure and do not mutate arguments', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 2, interval: '1s' });
      const state: LeakyBucketState = {
        level: 5000,
        at: 1000,
        a: config.a,
        b: config.b,
      };
      const stateClone = { ...state };
      const configClone = { ...config };

      leakyBucket.step(state, config, 2000, 1);
      expect(state).toEqual(stateClone);
      expect(config).toEqual(configClone);

      leakyBucket.peek(state, config, 2000);
      expect(state).toEqual(stateClone);
      expect(config).toEqual(configClone);
    });
  });

  describe('Cross-Algorithm Equivalence vs Token Bucket (fast-check)', () => {
    it('yields 100% identical Decisions and peeks for equivalent configs across random sequences', () => {
      fc.assert(
        fc.property(
          fc.record({
            capacity: fc.integer({ min: 1, max: 50 }),
            rate: fc.integer({ min: 1, max: 20 }),
            interval: fc.integer({ min: 10, max: 1000 }),
          }),
          fc.array(
            fc.record({
              dt: fc.integer({ min: -50, max: 1500 }), // includes backwards clock
              cost: fc.integer({ min: 1, max: 60 }), // includes cost > capacity
            }),
            { minLength: 1, maxLength: 40 },
          ),
          (cfg, requests) => {
            const lbConfig = leakyBucket.parseConfig({
              capacity: cfg.capacity,
              leak: cfg.rate,
              interval: cfg.interval,
            });
            const tbConfig = tokenBucket.parseConfig({
              capacity: cfg.capacity,
              refillTokens: cfg.rate,
              refillInterval: cfg.interval,
            });

            let lbState: LeakyBucketState | undefined = undefined;
            let tbState: TokenBucketState | undefined = undefined;
            let now = 10_000;

            for (const req of requests) {
              now = Math.max(0, now + req.dt);

              // Peek comparison
              const lbPeek = leakyBucket.peek(lbState, lbConfig, now);
              const tbPeek = tokenBucket.peek(tbState, tbConfig, now);
              expect(lbPeek).toEqual(tbPeek);

              // Step comparison
              const lbStep = leakyBucket.step(lbState, lbConfig, now, req.cost);
              const tbStep = tokenBucket.step(tbState, tbConfig, now, req.cost);

              expect(lbStep.decision).toEqual(tbStep.decision);
              expect(lbStep.nextState).toEqual(tbStep.nextState);

              lbState = lbStep.nextState;
              tbState = tbStep.nextState;
            }
          },
        ),
        { numRuns: 1000 },
      );
    });
  });

  describe('Independent Discrete Water-Model Oracle vs LeakyBucket', () => {
    it('matches discrete ms-by-ms water simulation over thousands of sequences', () => {
      fc.assert(
        fc.property(
          fc.record({
            capacity: fc.integer({ min: 1, max: 20 }),
            leak: fc.integer({ min: 1, max: 10 }),
            interval: fc.integer({ min: 10, max: 500 }),
          }),
          fc.array(
            fc.record({
              dt: fc.integer({ min: 0, max: 300 }),
              cost: fc.integer({ min: 1, max: 25 }),
            }),
            { minLength: 1, maxLength: 30 },
          ),
          (configInput, requests) => {
            const config = leakyBucket.parseConfig(configInput);
            const oracle = new WaterModelOracle(config, 0);

            let state: LeakyBucketState | undefined = undefined;
            let currentTime = 0;

            for (const req of requests) {
              currentTime += req.dt;
              oracle.advanceTo(currentTime);

              // Check peek
              const peekDecision = leakyBucket.peek(state, config, currentTime);
              const oraclePeek = oracle.peek();
              expect(peekDecision.allowed).toBe(oraclePeek.allowed);
              expect(peekDecision.limit).toBe(oraclePeek.limit);
              expect(peekDecision.remaining).toBe(oraclePeek.remaining);
              expect(peekDecision.resetAtMs).toBe(oraclePeek.resetAtMs);
              expect(peekDecision.retryAfterMs).toBe(oraclePeek.retryAfterMs);

              // Check step
              const { decision: actualDecision, nextState } = leakyBucket.step(
                state,
                config,
                currentTime,
                req.cost,
              );
              const expectedDecision = oracle.step(req.cost);

              expect(actualDecision.allowed).toBe(expectedDecision.allowed);
              expect(actualDecision.limit).toBe(expectedDecision.limit);
              expect(actualDecision.remaining).toBe(expectedDecision.remaining);
              expect(actualDecision.resetAtMs).toBe(expectedDecision.resetAtMs);
              expect(actualDecision.retryAfterMs).toBe(expectedDecision.retryAfterMs);

              state = nextState;
            }
          },
        ),
        { numRuns: 1000 },
      );
    });
  });

  describe('Manual Mutation Testing Pass (8 Mutations)', () => {
    it('Mutation 1: Swapped capacity and leak in parseConfig is caught', () => {
      const mutantParse = (input: LeakyBucketInput) => {
        return leakyBucket.parseConfig({
          capacity: input.leak,
          leak: input.capacity,
          interval: input.interval,
        });
      };
      const cfg = mutantParse({ capacity: 10, leak: 2, interval: '1s' });
      expect(cfg.capacity).not.toBe(10);
      expect(cfg.capacity).toBe(2);
    });

    it('Mutation 2: Initial state full instead of empty is caught', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 2, interval: '1s' });
      // Fresh bucket must start empty (0 water, all 10 remaining)
      const res = leakyBucket.step(undefined, config, 1000, 1);
      expect(res.decision.remaining).toBe(9); // if it started full (0 remaining), this would fail
    });

    it('Mutation 3: Wrong TTL (intervalMs instead of drainTimeMs) is caught', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 1, interval: '1s' });
      expect(leakyBucket.stateTtlMs(config)).toBe(10_000);
      expect(leakyBucket.stateTtlMs(config)).not.toBe(1000);
    });

    it('Mutation 4: Remaining computed from wrong side is caught', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 1, interval: '1s' });
      const res = leakyBucket.step(undefined, config, 1000, 4);
      // Room remaining is 10 - 4 = 6
      expect(res.decision.remaining).toBe(6);
      expect(res.decision.remaining).not.toBe(4);
    });

    it('Mutation 5: Reset computed as time to fill instead of time to drain is caught', () => {
      const config = leakyBucket.parseConfig({ capacity: 10, leak: 1, interval: '1s' });
      const res = leakyBucket.step(undefined, config, 1000, 3);
      // Drains in 3s -> resetAtMs = 4000
      expect(res.decision.resetAtMs).toBe(4000);
    });

    it('Mutation 6: Cost > capacity check missing or returning allowed is caught', () => {
      const config = leakyBucket.parseConfig({ capacity: 5, leak: 1, interval: '1s' });
      const res = leakyBucket.step(undefined, config, 1000, 100);
      expect(res.decision.allowed).toBe(false);
      expect(res.decision.retryAfterMs).toBeGreaterThan(0);
    });

    it('Mutation 7: Conflicting interval and leakInterval allowed is caught', () => {
      expect(() =>
        leakyBucket.parseConfig({
          capacity: 5,
          leak: 1,
          interval: '1s',
          leakInterval: '5s',
        }),
      ).toThrow('Conflicting interval');
    });

    it('Mutation 8: Curve-1 case: retryAfterMs computed incorrectly is caught', () => {
      const config = leakyBucket.parseConfig({ capacity: 1, leak: 1, interval: '100ms' });
      const r1 = leakyBucket.step(undefined, config, 1000, 1);
      const r2 = leakyBucket.step(r1.nextState, config, 1040, 1);
      expect(r2.decision.allowed).toBe(false);
      // 40ms passed, 60ms remaining
      expect(r2.decision.retryAfterMs).toBe(60);
    });
  });
});
