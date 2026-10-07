import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  tokenBucket,
  type TokenBucketConfig,
  type TokenBucketState,
} from '../algorithms/token-bucket.js';

describe('tokenBucket — Fast-Check Property Tests', () => {
  it('Rate envelope: total admitted units over [s, e] <= capacityUnits + (e - s) * a', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 20 }),
          refillTokens: fc.integer({ min: 1, max: 10 }),
          refillInterval: fc.integer({ min: 10, max: 500 }),
        }),
        fc.array(
          fc.record({
            dt: fc.integer({ min: 0, max: 200 }),
            cost: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 2, maxLength: 25 },
        ),
        (configInput, reqs) => {
          const config = tokenBucket.parseConfig(configInput);
          let state: TokenBucketState | undefined = undefined;
          let currentTime = 1000;
          const s = currentTime;
          let admittedUnits = 0;

          for (const req of reqs) {
            currentTime += req.dt;
            const res = tokenBucket.step(state, config, currentTime, req.cost);
            state = res.nextState;
            if (res.decision.allowed) {
              admittedUnits += req.cost * config.b;
            }
          }
          const e = currentTime;
          const maxAllowedUnits = config.capacityUnits + (e - s) * config.a;
          expect(admittedUnits).toBeLessThanOrEqual(maxAllowedUnits);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('Decision invariants: remaining in [0, capacity]; allowed => retryAfter=0; denied => retryAfter>=1', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 50 }),
          refillTokens: fc.integer({ min: 1, max: 20 }),
          refillInterval: fc.integer({ min: 1, max: 1000 }),
        }),
        fc.integer({ min: 0, max: 100_000 }), // nowMs
        fc.integer({ min: 1, max: 100 }), // cost
        (configInput, nowMs, cost) => {
          const config = tokenBucket.parseConfig(configInput);
          const res = tokenBucket.step(undefined, config, nowMs, cost);

          expect(res.decision.remaining).toBeGreaterThanOrEqual(0);
          expect(res.decision.remaining).toBeLessThanOrEqual(config.capacity);
          expect(res.decision.limit).toBe(config.capacity);

          if (res.decision.allowed) {
            expect(res.decision.retryAfterMs).toBe(0);
          } else {
            expect(res.decision.retryAfterMs).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('Monotonicity without admissions: remaining never decreases, retryAfter never increases', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 20 }),
          refillTokens: fc.integer({ min: 1, max: 5 }),
          refillInterval: fc.integer({ min: 10, max: 200 }),
        }),
        fc.integer({ min: 1, max: 500 }), // delta time
        fc.integer({ min: 1, max: 10 }), // fixed cost
        (configInput, dt, cost) => {
          const config = tokenBucket.parseConfig(configInput);
          // Start with an empty bucket
          const state: TokenBucketState = {
            level: 0,
            at: 1000,
            a: config.a,
            b: config.b,
          };

          const p1 = tokenBucket.peek(state, config, 1000);
          const p2 = tokenBucket.peek(state, config, 1000 + dt);
          expect(p2.remaining).toBeGreaterThanOrEqual(p1.remaining);

          const d1 = tokenBucket.step(state, config, 1000, cost);
          const d2 = tokenBucket.step(state, config, 1000 + dt, cost);

          if (!d1.decision.allowed && !d2.decision.allowed) {
            expect(d2.decision.retryAfterMs).toBeLessThanOrEqual(d1.decision.retryAfterMs);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Peek consistency with step(cost=1)', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 20 }),
          refillTokens: fc.integer({ min: 1, max: 10 }),
          refillInterval: fc.integer({ min: 10, max: 500 }),
        }),
        fc.integer({ min: 0, max: 20 }), // initial tokens in bucket
        fc.integer({ min: 1000, max: 50_000 }), // nowMs
        (configInput, initTokens, nowMs) => {
          const config = tokenBucket.parseConfig(configInput);
          const clampedInit = Math.min(initTokens, config.capacity);
          const state: TokenBucketState = {
            level: clampedInit * config.b,
            at: nowMs,
            a: config.a,
            b: config.b,
          };

          const peek = tokenBucket.peek(state, config, nowMs);
          const step = tokenBucket.step(state, config, nowMs, 1);

          expect(peek.allowed).toBe(step.decision.allowed);
          expect(peek.remaining).toBe(step.decision.remaining + (step.decision.allowed ? 1 : 0));

          if (!step.decision.allowed) {
            expect(peek.retryAfterMs).toBe(step.decision.retryAfterMs);
            expect(peek.resetAtMs).toBe(step.decision.resetAtMs);
          } else {
            expect(peek.retryAfterMs).toBe(0);
            expect(step.decision.retryAfterMs).toBe(0);
            expect(step.decision.resetAtMs).toBeGreaterThanOrEqual(peek.resetAtMs);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Expiry is behaviour-preserving: decisions at >= at + stateTtlMs identical with and without state', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 15 }),
          refillTokens: fc.integer({ min: 1, max: 5 }),
          refillInterval: fc.integer({ min: 10, max: 300 }),
        }),
        fc.integer({ min: 0, max: 15 }), // remaining level
        fc.integer({ min: 0, max: 5000 }), // extra elapsed past TTL
        fc.integer({ min: 1, max: 20 }), // cost
        (configInput, levelTokens, extraMs, cost) => {
          const config = tokenBucket.parseConfig(configInput);
          const ttlMs = tokenBucket.stateTtlMs(config);
          const writtenAt = 10_000;
          const state: TokenBucketState = {
            level: Math.min(levelTokens, config.capacity) * config.b,
            at: writtenAt,
            a: config.a,
            b: config.b,
          };

          const checkTime = writtenAt + ttlMs + extraMs;

          // Evaluation with state present
          const withState = tokenBucket.step(state, config, checkTime, cost);
          // Evaluation with state absent (expired)
          const withoutState = tokenBucket.step(undefined, config, checkTime, cost);

          expect(withState.decision).toEqual(withoutState.decision);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Backwards clock: outcome equals outcome at stored at, never more generous', () => {
    fc.assert(
      fc.property(
        fc.record({
          capacity: fc.integer({ min: 1, max: 20 }),
          refillTokens: fc.integer({ min: 1, max: 5 }),
          refillInterval: fc.integer({ min: 10, max: 300 }),
        }),
        fc.integer({ min: 0, max: 20 }), // level tokens
        fc.integer({ min: 1, max: 5000 }), // backwards jump (ms)
        fc.integer({ min: 1, max: 25 }), // cost
        (configInput, levelTokens, backwardsDelta, cost) => {
          const config = tokenBucket.parseConfig(configInput);
          const storedAt = 50_000;
          const state: TokenBucketState = {
            level: Math.min(levelTokens, config.capacity) * config.b,
            at: storedAt,
            a: config.a,
            b: config.b,
          };

          const nowMs = storedAt - backwardsDelta; // in the past!
          const resultBackwards = tokenBucket.step(state, config, nowMs, cost);
          const resultAtStored = tokenBucket.step(state, config, storedAt, cost);

          // Never more generous: remaining cannot exceed what was there at storedAt
          expect(resultBackwards.decision.remaining).toBeLessThanOrEqual(
            resultAtStored.decision.remaining,
          );
          expect(resultBackwards.decision.allowed).toBe(resultAtStored.decision.allowed);

          // State time never moves backwards
          expect(resultBackwards.nextState.at).toBe(storedAt);

          if (!resultBackwards.decision.allowed) {
            // retryAfter reflects the time to catch up to storedAt plus refill
            expect(resultBackwards.decision.retryAfterMs).toBe(
              resultAtStored.decision.retryAfterMs + backwardsDelta,
            );
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Config changes: capacity changes never add tokens, rate changes preserve whole tokens only', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }), // old cap
        fc.integer({ min: 1, max: 25 }), // new cap
        fc.integer({ min: 0, max: 20 }), // tokens in bucket
        (oldCap, newCap, currentTokens) => {
          const oldConfig = tokenBucket.parseConfig({
            capacity: oldCap,
            refillTokens: 1,
            refillInterval: 1000,
          });
          const clamped = Math.min(currentTokens, oldCap);
          const state: TokenBucketState = {
            level: clamped * oldConfig.b,
            at: 1000,
            a: oldConfig.a,
            b: oldConfig.b,
          };

          const newConfig = tokenBucket.parseConfig({
            capacity: newCap,
            refillTokens: 2,
            refillInterval: 500, // new rate
          });

          const peek = tokenBucket.peek(state, newConfig, 1000);
          // Never more whole tokens than before, and never more than new capacity
          expect(peek.remaining).toBeLessThanOrEqual(Math.min(clamped, newCap));
        },
      ),
      { numRuns: 300 },
    );
  });
});
