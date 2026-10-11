import { describe, expect, it } from 'vitest';
import { tokenBucket, type TokenBucketState } from '../algorithms/token-bucket.js';
import {
  gcd,
  normaliseRate,
  clampSafeRefill,
  ceilTimeToLevel,
  resolveStartingLevel,
  MAX_SAFE_CAPACITY,
  MAX_CAPACITY_UNITS,
} from '../algorithms/token-bucket.js';
import { ConfigError } from '../errors.js';

describe('tokenBucket — Pure Arithmetic Helpers', () => {
  it('gcd computes greatest common divisor correctly', () => {
    expect(gcd(10, 1000)).toBe(10);
    expect(gcd(3, 1000)).toBe(1);
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
    expect(gcd(5, 0)).toBe(5);
    expect(gcd(-10, 100)).toBe(10);
  });

  it('normaliseRate reduces rates to irreducible integers', () => {
    expect(normaliseRate(10, 1000)).toEqual({ a: 1, b: 100 });
    expect(normaliseRate(1, 100)).toEqual({ a: 1, b: 100 });
    expect(normaliseRate(3, 1000)).toEqual({ a: 3, b: 1000 });
    expect(normaliseRate(5000, 1000)).toEqual({ a: 5, b: 1 });
  });

  it('resolveStartingLevel handles fresh bucket', () => {
    const config = tokenBucket.parseConfig({
      capacity: 5,
      refillTokens: 1,
      refillInterval: 1000,
    });
    const res = resolveStartingLevel(undefined, config, 1234);
    expect(res.effectiveNow).toBe(1234);
    expect(res.refilled).toBe(config.capacityUnits);
  });

  it('resolveStartingLevel clamps elapsed before multiplying to prevent overflow', () => {
    const config = tokenBucket.parseConfig({
      capacity: 5,
      refillTokens: 1,
      refillInterval: 1000,
    });
    const state: TokenBucketState = {
      level: 0,
      at: 1000,
      a: config.a,
      b: config.b,
    };
    // Huge elapsed time: 10^16 ms
    const res = resolveStartingLevel(state, config, 1000 + 10_000_000_000_000_000);
    expect(res.effectiveNow).toBe(1000 + 10_000_000_000_000_000);
    expect(res.refilled).toBe(config.capacityUnits);
  });

  it('clampSafeRefill guarantees safe integer bounds and clamps elapsed', () => {
    // If elapsed (1e16) is not clamped to fullRefillMs before multiplying by a (2),
    // 1e16 * 2 = 2e16 exceeds MAX_SAFE_INTEGER and throws RangeError.
    const fullRefillMs = 5000;
    const a = 2;
    const capacityUnits = 10000;
    const refilled = clampSafeRefill(0, 10_000_000_000_000_000, fullRefillMs, a, capacityUnits);
    expect(refilled).toBe(capacityUnits);

    // If an intermediate somehow exceeds safe integer bounds, RangeError is thrown
    expect(() =>
      clampSafeRefill(Number.MAX_SAFE_INTEGER, 10, 10, 100, Number.MAX_SAFE_INTEGER),
    ).toThrow(RangeError);
  });

  it('ceilTimeToLevel returns exact ceiling milliseconds', () => {
    expect(ceilTimeToLevel(0, 5)).toBe(0);
    expect(ceilTimeToLevel(-10, 5)).toBe(0);
    expect(ceilTimeToLevel(1, 3)).toBe(1);
    expect(ceilTimeToLevel(1000, 3)).toBe(334);
    expect(ceilTimeToLevel(1000, 1)).toBe(1000);
  });
});

describe('tokenBucket — Config Validation Matrix', () => {
  it('rejects non-object configs', () => {
    expect(() => tokenBucket.parseConfig(null)).toThrow(ConfigError);
    expect(() => tokenBucket.parseConfig(undefined)).toThrow(ConfigError);
    expect(() => tokenBucket.parseConfig(123)).toThrow(ConfigError);
    expect(() => tokenBucket.parseConfig('string')).toThrow(ConfigError);
    expect(() => tokenBucket.parseConfig([])).toThrow(ConfigError);
  });

  it('rejects unknown keys', () => {
    expect(() =>
      tokenBucket.parseConfig({
        capacity: 10,
        refillTokens: 1,
        refillInterval: '1s',
        extra: true,
      }),
    ).toThrow(ConfigError);
  });

  it('validates capacity', () => {
    // Missing
    expect(() => tokenBucket.parseConfig({ refillTokens: 1, refillInterval: '1s' })).toThrow(
      ConfigError,
    );

    // Non-integers / non-numbers / out of range
    const invalidCapacities = [0, -1, 1.5, NaN, Infinity, -Infinity, '10', MAX_SAFE_CAPACITY + 1];
    for (const cap of invalidCapacities) {
      expect(() =>
        tokenBucket.parseConfig({
          capacity: cap as number,
          refillTokens: 1,
          refillInterval: '1s',
        }),
      ).toThrow(ConfigError);
    }
  });

  it('validates refillTokens', () => {
    // Missing
    expect(() => tokenBucket.parseConfig({ capacity: 10, refillInterval: '1s' })).toThrow(
      ConfigError,
    );

    // Non-integers / non-numbers / out of range
    const invalidTokens = [0, -1, 2.5, NaN, Infinity, -Infinity, '1', MAX_SAFE_CAPACITY + 1];
    for (const tok of invalidTokens) {
      expect(() =>
        tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: tok as number,
          refillInterval: '1s',
        }),
      ).toThrow(ConfigError);
    }
  });

  it('validates refillInterval', () => {
    // Missing
    expect(() => tokenBucket.parseConfig({ capacity: 10, refillTokens: 1 })).toThrow(ConfigError);

    // Invalid formats
    const invalidIntervals = [0, -100, 'invalid', '100', '100s ', ' 100s', '1yr'];
    for (const inv of invalidIntervals) {
      expect(() =>
        tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 1,
          refillInterval: inv as unknown as string,
        }),
      ).toThrow(ConfigError);
    }
  });

  it('enforces capacityUnits <= 2^51 bound', () => {
    // When refillTokens is large (e.g. 2^31 - 1), a is large so fullRefillMs stays small.
    const maxCapacity = MAX_SAFE_CAPACITY;
    const largeRefillTokens = MAX_SAFE_CAPACITY;

    // Just above 2^51:
    // b = 1_048_577 with gcd = 1 gives capacityUnits = (2^31 - 1) * 1_048_577 > 2^51
    const overflowIntervalMs = 1_048_577;
    expect(() =>
      tokenBucket.parseConfig({
        capacity: maxCapacity,
        refillTokens: largeRefillTokens,
        refillInterval: overflowIntervalMs,
      }),
    ).toThrow('Token bucket capacityUnits');

    // Just below 2^51:
    // b = 1_048_576 gives capacityUnits = (2^31 - 1) * 1_048_576 <= 2^51
    const safeIntervalMs = 1_048_576;
    const config = tokenBucket.parseConfig({
      capacity: maxCapacity,
      refillTokens: largeRefillTokens,
      refillInterval: safeIntervalMs,
    });
    expect(config.capacityUnits).toBeLessThanOrEqual(MAX_CAPACITY_UNITS);
  });

  it('rejects fullRefillMs exceeding MAX_DURATION_MS (366 days)', () => {
    // capacity = 1_000_000, refillTokens = 1, interval = 100 days
    // fullRefillMs = 1_000_000 * 100 days = 100_000_000 days > 366 days
    expect(() =>
      tokenBucket.parseConfig({
        capacity: 1_000_000,
        refillTokens: 1,
        refillInterval: '1d',
      }),
    ).toThrow(ConfigError);
  });
});

describe('tokenBucket — Golden Examples', () => {
  const configA = tokenBucket.parseConfig({
    capacity: 5,
    refillTokens: 1,
    refillInterval: 1000,
  });

  it('Config A: drain 5 tokens at t=0, 6th denied, partial refill at t=500, allowed at t=1000', () => {
    let state: TokenBucketState | undefined = undefined;

    // t=0, five requests of cost 1: all allowed; remaining 4, 3, 2, 1, 0; resetAt 1000, 2000, 3000, 4000, 5000; retryAfter 0
    const expectedRemainings = [4, 3, 2, 1, 0];
    const expectedResetAts = [1000, 2000, 3000, 4000, 5000];

    for (let i = 0; i < 5; i++) {
      const res = tokenBucket.step(state, configA, 0, 1);
      expect(res.decision.allowed).toBe(true);
      expect(res.decision.remaining).toBe(expectedRemainings[i]);
      expect(res.decision.resetAtMs).toBe(expectedResetAts[i]);
      expect(res.decision.retryAfterMs).toBe(0);
      state = res.nextState;
    }

    // t=0, sixth: denied; remaining 0; resetAt 5000; retryAfter 1000
    const res6 = tokenBucket.step(state, configA, 0, 1);
    expect(res6.decision.allowed).toBe(false);
    expect(res6.decision.remaining).toBe(0);
    expect(res6.decision.resetAtMs).toBe(5000);
    expect(res6.decision.retryAfterMs).toBe(1000);
    // Denied request does not advance state
    expect(res6.nextState).toBe(state);

    // t=500: denied; remaining 0; resetAt 5000; retryAfter 500
    const res500 = tokenBucket.step(state, configA, 500, 1);
    expect(res500.decision.allowed).toBe(false);
    expect(res500.decision.remaining).toBe(0);
    expect(res500.decision.resetAtMs).toBe(5000);
    expect(res500.decision.retryAfterMs).toBe(500);
    expect(res500.nextState).toBe(state);

    // t=1000: allowed; remaining 0; resetAt 6000
    const res1000 = tokenBucket.step(state, configA, 1000, 1);
    expect(res1000.decision.allowed).toBe(true);
    expect(res1000.decision.remaining).toBe(0);
    expect(res1000.decision.resetAtMs).toBe(6000);
    expect(res1000.decision.retryAfterMs).toBe(0);
    state = res1000.nextState;

    // Again at t=1000: denied; retryAfter 1000
    const res1000Denied = tokenBucket.step(state, configA, 1000, 1);
    expect(res1000Denied.decision.allowed).toBe(false);
    expect(res1000Denied.decision.remaining).toBe(0);
    expect(res1000Denied.decision.resetAtMs).toBe(6000);
    expect(res1000Denied.decision.retryAfterMs).toBe(1000);

    // t=11000: allowed; remaining 4; resetAt 12000 (bucket refilled completely)
    const res11000 = tokenBucket.step(state, configA, 11000, 1);
    expect(res11000.decision.allowed).toBe(true);
    expect(res11000.decision.remaining).toBe(4);
    expect(res11000.decision.resetAtMs).toBe(12000);
    expect(res11000.decision.retryAfterMs).toBe(0);
  });

  const configB = tokenBucket.parseConfig({
    capacity: 3,
    refillTokens: 3,
    refillInterval: 1000,
  });

  it('Config B: fractional rate exactness and zero drift', () => {
    let state: TokenBucketState | undefined = undefined;

    // t=0 cost 3: allowed; remaining 0; resetAt 1000
    const res0 = tokenBucket.step(state, configB, 0, 3);
    expect(res0.decision.allowed).toBe(true);
    expect(res0.decision.remaining).toBe(0);
    expect(res0.decision.resetAtMs).toBe(1000);
    state = res0.nextState;

    // t=0 cost 1: denied; retryAfter 334
    const res0Cost1 = tokenBucket.step(state, configB, 0, 1);
    expect(res0Cost1.decision.allowed).toBe(false);
    expect(res0Cost1.decision.retryAfterMs).toBe(334);

    // t=333 cost 1: denied; retryAfter 1
    const res333 = tokenBucket.step(state, configB, 333, 1);
    expect(res333.decision.allowed).toBe(false);
    expect(res333.decision.retryAfterMs).toBe(1);

    // t=334 cost 1: allowed; remaining 0; resetAt 1334
    const res334 = tokenBucket.step(state, configB, 334, 1);
    expect(res334.decision.allowed).toBe(true);
    expect(res334.decision.remaining).toBe(0);
    expect(res334.decision.resetAtMs).toBe(1334);
    state = res334.nextState;

    // t=667 cost 1: allowed
    const res667 = tokenBucket.step(state, configB, 667, 1);
    expect(res667.decision.allowed).toBe(true);
    state = res667.nextState;

    // t=1000 cost 1: allowed (no drift)
    const res1000 = tokenBucket.step(state, configB, 1000, 1);
    expect(res1000.decision.allowed).toBe(true);
  });

  const configC = tokenBucket.parseConfig({
    capacity: 10,
    refillTokens: 10,
    refillInterval: 1000,
  });

  it('Config C: rate reduction (10 per 1000ms normalises to 1 per 100ms)', () => {
    expect(configC.a).toBe(1);
    expect(configC.b).toBe(100);

    let state: TokenBucketState | undefined = undefined;

    // t=0 cost 4: allowed; remaining 6; resetAt 400
    const res1 = tokenBucket.step(state, configC, 0, 4);
    expect(res1.decision.allowed).toBe(true);
    expect(res1.decision.remaining).toBe(6);
    expect(res1.decision.resetAtMs).toBe(400);
    state = res1.nextState;

    // t=0 cost 7: denied; remaining 6; retryAfter 100
    const res2 = tokenBucket.step(state, configC, 0, 7);
    expect(res2.decision.allowed).toBe(false);
    expect(res2.decision.remaining).toBe(6);
    expect(res2.decision.retryAfterMs).toBe(100);

    // t=100 cost 7: allowed; remaining 0; resetAt 1100
    const res3 = tokenBucket.step(state, configC, 100, 7);
    expect(res3.decision.allowed).toBe(true);
    expect(res3.decision.remaining).toBe(0);
    expect(res3.decision.resetAtMs).toBe(1100);
  });

  it('Backwards clock handling', () => {
    const storedState: TokenBucketState = {
      level: 2000,
      at: 10000,
      a: 1,
      b: 1000,
    };

    // t=9000 cost 1: allowed with no refill; remaining 1; resetAt 14000
    const res1 = tokenBucket.step(storedState, configA, 9000, 1);
    expect(res1.decision.allowed).toBe(true);
    expect(res1.decision.remaining).toBe(1);
    expect(res1.decision.resetAtMs).toBe(14000);
    expect(res1.decision.retryAfterMs).toBe(0);
    expect(res1.nextState.at).toBe(10000);

    // t=9000 cost 3: denied; remaining 2; retryAfter 2000; resetAt 13000
    const res3 = tokenBucket.step(storedState, configA, 9000, 3);
    expect(res3.decision.allowed).toBe(false);
    expect(res3.decision.remaining).toBe(2);
    expect(res3.decision.retryAfterMs).toBe(2000);
    expect(res3.decision.resetAtMs).toBe(13000);
  });

  it('Config changes: capacity decrease clamps level', () => {
    const state: TokenBucketState = {
      level: 4000,
      at: 0,
      a: 1,
      b: 1000,
    };
    const configLowerCap = tokenBucket.parseConfig({
      capacity: 2,
      refillTokens: 1,
      refillInterval: 1000,
    });
    // Level clamps from 4000 to 2000; cost 1 allowed; remaining 1
    const res = tokenBucket.step(state, configLowerCap, 0, 1);
    expect(res.decision.allowed).toBe(true);
    expect(res.decision.remaining).toBe(1);
    expect(res.nextState.level).toBe(1000);
  });

  it('Config changes: capacity increase does not grant instant headroom', () => {
    const state: TokenBucketState = {
      level: 1000,
      at: 0,
      a: 1,
      b: 1000,
    };
    const configHigherCap = tokenBucket.parseConfig({
      capacity: 10,
      refillTokens: 1,
      refillInterval: 1000,
    });
    const peek = tokenBucket.peek(state, configHigherCap, 0);
    expect(peek.remaining).toBe(1);
  });

  it('Config changes: rate change converts whole tokens conservatively', () => {
    const state: TokenBucketState = {
      level: 2500, // 2 whole tokens + 500 fractional units
      at: 0,
      a: 1,
      b: 1000,
    };
    const configNewRate = tokenBucket.parseConfig({
      capacity: 5,
      refillTokens: 2,
      refillInterval: 1000, // normalises to a=1, b=500
    });
    const peek = tokenBucket.peek(state, configNewRate, 0);
    expect(peek.remaining).toBe(2);
  });

  it('Equivalent representations behave identically', () => {
    const cfg1 = tokenBucket.parseConfig({ capacity: 10, refillTokens: 10, refillInterval: 1000 });
    const cfg2 = tokenBucket.parseConfig({ capacity: 10, refillTokens: 1, refillInterval: 100 });

    expect(cfg1.a).toBe(cfg2.a);
    expect(cfg1.b).toBe(cfg2.b);
    expect(cfg1.capacityUnits).toBe(cfg2.capacityUnits);

    const s1 = tokenBucket.step(undefined, cfg1, 0, 3);
    const s2 = tokenBucket.step(undefined, cfg2, 0, 3);
    expect(s1.decision).toEqual(s2.decision);
    expect(s1.nextState).toEqual(s2.nextState);
  });

  it('Extremes: cost Number.MAX_SAFE_INTEGER follows cost > capacity rule', () => {
    const res = tokenBucket.step(undefined, configA, 0, Number.MAX_SAFE_INTEGER);
    expect(res.decision.allowed).toBe(false);
    expect(res.decision.limit).toBe(5);
    expect(res.decision.remaining).toBe(5);
    expect(res.decision.retryAfterMs).toBeGreaterThan(0);
    expect(res.decision.degraded).toBe(false);

    // On partially depleted bucket, timeToFull > 0
    const statePart: TokenBucketState = {
      level: 2000,
      at: 0,
      a: configA.a,
      b: configA.b,
    };
    const resPart = tokenBucket.step(statePart, configA, 0, 100);
    expect(resPart.decision.allowed).toBe(false);
    expect(resPart.decision.retryAfterMs).toBe(3000);
  });
});

describe('tokenBucket — Exactness and Invariants', () => {
  const config = tokenBucket.parseConfig({
    capacity: 10,
    refillTokens: 2,
    refillInterval: 1000, // a=1, b=500, capacityUnits=5000
  });

  it('retryAfter exactness: success at +retryAfterMs, failure at +retryAfterMs - 1', () => {
    // Drain all 10 tokens
    const step1 = tokenBucket.step(undefined, config, 0, 10);
    expect(step1.decision.allowed).toBe(true);
    expect(step1.decision.remaining).toBe(0);

    const checkCost = 3; // 3 tokens requires 1500 units. At rate 1 unit/ms, takes 1500 ms.
    const denied = tokenBucket.step(step1.nextState, config, 0, checkCost);
    expect(denied.decision.allowed).toBe(false);
    const retryAfter = denied.decision.retryAfterMs;
    expect(retryAfter).toBe(1500);

    // 1 ms before retryAfter: must fail
    const early = tokenBucket.step(step1.nextState, config, retryAfter - 1, checkCost);
    expect(early.decision.allowed).toBe(false);

    // Exactly at retryAfter: must succeed
    const exact = tokenBucket.step(step1.nextState, config, retryAfter, checkCost);
    expect(exact.decision.allowed).toBe(true);
    expect(exact.decision.remaining).toBe(0);
  });

  it('resetAt exactness: bucket is full at resetAtMs, not full at resetAtMs - 1', () => {
    const step = tokenBucket.step(undefined, config, 0, 4);
    expect(step.decision.remaining).toBe(6);
    const resetAt = step.decision.resetAtMs;

    // At resetAt - 1: not yet full
    const peekBefore = tokenBucket.peek(step.nextState, config, resetAt - 1);
    expect(peekBefore.remaining).toBeLessThan(config.capacity);

    // At resetAt: fully refilled
    const peekAt = tokenBucket.peek(step.nextState, config, resetAt);
    expect(peekAt.remaining).toBe(config.capacity);
  });

  it('peek on empty bucket reports allowed: false and positive retryAfterMs', () => {
    // Empty bucket state
    const emptyState: TokenBucketState = {
      level: 0,
      at: 0,
      a: config.a,
      b: config.b,
    };
    const peek = tokenBucket.peek(emptyState, config, 0);
    expect(peek.allowed).toBe(false);
    expect(peek.remaining).toBe(0);
    expect(peek.retryAfterMs).toBe(config.b / config.a);
  });

  it('purity: input state is not mutated when frozen', () => {
    const state: TokenBucketState = Object.freeze({
      level: 2500,
      at: 1000,
      a: 1,
      b: 500,
    });
    expect(() => tokenBucket.step(state, config, 2000, 1)).not.toThrow();
    expect(() => tokenBucket.peek(state, config, 2000)).not.toThrow();
  });

  it('stateTtlMs strictly equals fullRefillMs', () => {
    expect(tokenBucket.stateTtlMs(config)).toBe(config.fullRefillMs);
    expect(tokenBucket.stateTtlMs(config)).toBe(5000);
  });
});
