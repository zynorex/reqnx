import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  tokenBucket,
  type TokenBucketConfig,
  type TokenBucketState,
} from '../algorithms/token-bucket.js';

/**
 * Independent oracle simulating the token bucket discrete millisecond by millisecond.
 * Zero closed-form formulas, zero shared implementation code.
 */
class TokenBucketOracle {
  public currentLevel: number;
  public currentTimeMs: number;
  public readonly a: number;
  public readonly b: number;
  public readonly capacityUnits: number;
  public readonly capacity: number;

  constructor(config: TokenBucketConfig, initialTimeMs = 0) {
    this.a = config.a;
    this.b = config.b;
    this.capacity = config.capacity;
    this.capacityUnits = config.capacityUnits;
    this.currentTimeMs = initialTimeMs;
    // New bucket starts full
    this.currentLevel = this.capacityUnits;
  }

  /**
   * Advance time ms-by-ms, adding `a` units per ms and clamping at capacityUnits.
   */
  public advanceTo(targetTimeMs: number): void {
    if (targetTimeMs <= this.currentTimeMs) {
      return;
    }
    while (this.currentTimeMs < targetTimeMs) {
      this.currentTimeMs++;
      this.currentLevel = Math.min(this.capacityUnits, this.currentLevel + this.a);
    }
  }

  /**
   * Simulate a request at currentTimeMs with given cost.
   */
  public step(cost: number): {
    allowed: boolean;
    remaining: number;
    resetAtMs: number;
    retryAfterMs: number;
  } {
    if (cost > this.capacity) {
      // Cannot ever be admitted
      const remaining = Math.floor(this.currentLevel / this.b);
      // Simulate future ms until full
      let simLevel = this.currentLevel;
      let msToFull = 0;
      while (simLevel < this.capacityUnits) {
        msToFull++;
        simLevel = Math.min(this.capacityUnits, simLevel + this.a);
      }
      const resetAtMs = this.currentTimeMs + msToFull;
      const fullRefillMs = Math.ceil(this.capacityUnits / this.a);
      const retryAfterMs = msToFull > 0 ? msToFull : fullRefillMs;
      return {
        allowed: false,
        remaining,
        resetAtMs,
        retryAfterMs,
      };
    }

    const need = cost * this.b;
    const allowed = this.currentLevel >= need;

    if (allowed) {
      this.currentLevel -= need;
      const remaining = Math.floor(this.currentLevel / this.b);
      // Simulate future ms until full
      let simLevel = this.currentLevel;
      let msToFull = 0;
      while (simLevel < this.capacityUnits) {
        msToFull++;
        simLevel = Math.min(this.capacityUnits, simLevel + this.a);
      }
      return {
        allowed: true,
        remaining,
        resetAtMs: this.currentTimeMs + msToFull,
        retryAfterMs: 0,
      };
    } else {
      // Denied: state does not change
      const remaining = Math.floor(this.currentLevel / this.b);
      // Simulate future ms until full
      let simLevel = this.currentLevel;
      let msToFull = 0;
      while (simLevel < this.capacityUnits) {
        msToFull++;
        simLevel = Math.min(this.capacityUnits, simLevel + this.a);
      }
      // Simulate future ms until need is met
      let simNeedLevel = this.currentLevel;
      let msToNeed = 0;
      while (simNeedLevel < need) {
        msToNeed++;
        simNeedLevel = Math.min(this.capacityUnits, simNeedLevel + this.a);
      }
      return {
        allowed: false,
        remaining,
        resetAtMs: this.currentTimeMs + msToFull,
        retryAfterMs: msToNeed,
      };
    }
  }
}

describe('tokenBucket — Model-Based Testing against Discrete Oracle', () => {
  it('matches discrete ms-by-ms simulation over thousands of fast-check sequences', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 20 }),
          refillTokens: fc.integer({ min: 1, max: 10 }),
          refillInterval: fc.integer({ min: 10, max: 500 }),
        }),
        fc.array(
          fc.record({
            dt: fc.integer({ min: 0, max: 300 }),
            cost: fc.integer({ min: 1, max: 25 }),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (configInput, requests) => {
          const config = tokenBucket.parseConfig(configInput);
          const oracle = new TokenBucketOracle(config, 0);

          let state: TokenBucketState | undefined = undefined;
          let currentTime = 0;

          for (const req of requests) {
            currentTime += req.dt;
            if (currentTime > 5000) break; // horizon limit

            oracle.advanceTo(currentTime);
            const oracleDecision = oracle.step(req.cost);

            const result = tokenBucket.step(state, config, currentTime, req.cost);
            state = result.nextState;

            expect(result.decision.allowed).toBe(oracleDecision.allowed);
            expect(result.decision.remaining).toBe(oracleDecision.remaining);
            expect(result.decision.resetAtMs).toBe(oracleDecision.resetAtMs);
            expect(result.decision.retryAfterMs).toBe(oracleDecision.retryAfterMs);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
