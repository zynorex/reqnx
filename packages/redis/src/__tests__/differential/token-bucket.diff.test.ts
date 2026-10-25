// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Differential Tests: tokenBucket
//
// Proves exact equivalence between @reqnx/core tokenBucket and RedisStore Lua port.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { tokenBucket } from '@reqnx/core';
import {
  isRedisAvailable,
  setupDifferentialStore,
  runDifferentialSequence,
  assertDecisionMatch,
  neutraliseTtl,
  type DifferentialContext,
} from './harness.js';
import { RedisStoreError } from '../../adapters/base.js';

describe('tokenBucket Differential Suite (TypeScript vs Redis Lua)', () => {
  let redisOnline = false;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) {
      console.warn(
        '⚠️  Redis server is not reachable at REDIS_URL. Differential tests will skip gracefully in local dev.',
      );
    }
  });

  const adapters = ['node-redis', 'ioredis'] as const;

  for (const adapterType of adapters) {
    describe(`Adapter: ${adapterType}`, () => {
      let ctx: DifferentialContext;

      beforeAll(async () => {
        if (redisOnline) {
          ctx = await setupDifferentialStore(adapterType);
        }
      });

      afterAll(async () => {
        if (ctx) {
          await ctx.cleanup();
        }
      });

      it('Golden Case 1: Smooth countdown to empty (5 calls of cost 1 with capacity 5)', async () => {
        if (!redisOnline) return;

        const config = tokenBucket.parseConfig({
          capacity: 5,
          refillTokens: 1,
          refillInterval: '1s',
        });
        const steps = [
          { advanceMs: 0, cost: 1 },
          { advanceMs: 10, cost: 1 },
          { advanceMs: 10, cost: 1 },
          { advanceMs: 10, cost: 1 },
          { advanceMs: 10, cost: 1 },
          { advanceMs: 10, cost: 1 }, // 6th call: denied (remaining: 0, retryAfterMs approx 950ms)
        ];

        await runDifferentialSequence(
          ctx,
          tokenBucket,
          config,
          steps,
          `test:tb:golden1:${adapterType}`,
        );
      });

      it('Golden Case 2: Partial refill and consumption', async () => {
        if (!redisOnline) return;

        const config = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 2,
          refillInterval: '1s',
        });
        const steps = [
          { advanceMs: 0, cost: 8 }, // consumes 8, 2 remaining
          { advanceMs: 1000, cost: 3 }, // refills 2 -> 4 available, consumes 3 -> 1 remaining
          { advanceMs: 250, cost: 2 }, // refills 0 (need 500ms for 1 token) -> denied
          { advanceMs: 500, cost: 2 }, // refills 1 -> 2 available, consumes 2 -> 0 remaining
        ];

        await runDifferentialSequence(
          ctx,
          tokenBucket,
          config,
          steps,
          `test:tb:golden2:${adapterType}`,
        );
      });

      it('Golden Case 3: Extreme cost > capacity is denied without state mutation', async () => {
        if (!redisOnline) return;

        const config = tokenBucket.parseConfig({
          capacity: 5,
          refillTokens: 1,
          refillInterval: '1s',
        });
        const key = `test:tb:extreme:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(tokenBucket);

        // 1. Consume 2 tokens
        const d1 = await ctx.store.consume(wrappedAlgo, key, config, 2);
        expect(d1.allowed).toBe(true);
        expect(d1.remaining).toBe(3);

        // 2. Request cost 999 (greater than capacity 5) -> denied
        const d2 = await ctx.store.consume(wrappedAlgo, key, config, 999);
        expect(d2.allowed).toBe(false);
        expect(d2.remaining).toBe(3);

        // 3. Request cost 3 -> should succeed immediately
        const d3 = await ctx.store.consume(wrappedAlgo, key, config, 3);
        expect(d3.allowed).toBe(true);
        expect(d3.remaining).toBe(0);

        await ctx.store.reset(key);
      });

      it('Golden Case 4: Backwards clock protection (NTP backward jump)', async () => {
        if (!redisOnline) return;

        const config = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 1,
          refillInterval: '1s',
        });
        const key = `test:tb:backwards:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(tokenBucket);

        ctx.clock.set(1_000_000);
        const d1 = await ctx.store.consume(wrappedAlgo, key, config, 5);
        expect(d1.allowed).toBe(true);
        expect(d1.remaining).toBe(5);

        // Clock moves backwards by 2000ms
        ctx.clock.set(998_000);

        const expected = tokenBucket.step(
          { level: 5 * config.b, at: 1_000_000, a: config.a, b: config.b },
          config,
          998_000,
          1,
        );
        const actual = await ctx.store.consume(wrappedAlgo, key, config, 1);

        assertDecisionMatch(actual, expected.decision, 'Backwards clock check');
        expect(actual.remaining).toBe(4);

        await ctx.store.reset(key);
      });

      it('Golden Case 5: Dynamic rate change conversion', async () => {
        if (!redisOnline) return;

        const key = `test:tb:ratechange:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const configA = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 1,
          refillInterval: '1s',
        });
        const configB = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 5,
          refillInterval: '1s',
        });

        ctx.clock.set(1_000_000);
        const d1 = await ctx.store.consume(neutraliseTtl(tokenBucket), key, configA, 4);
        expect(d1.remaining).toBe(6);

        // Next call uses configB with different rate (a/b)
        const d2 = await ctx.store.consume(neutraliseTtl(tokenBucket), key, configB, 2);
        expect(d2.allowed).toBe(true);
        expect(d2.remaining).toBe(4);

        await ctx.store.reset(key);
      });

      it('Handles corrupt state by raising REQNX_CORRUPT_STATE StoreError', async () => {
        if (!redisOnline) return;

        const config = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 1,
          refillInterval: '1s',
        });
        const key = `test:tb:corrupt:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        await ctx.adapter.eval(
          "redis.call('HSET', KEYS[1], 'v', 1, 'l', 'INVALID', 'at', 1000, 'a', 1, 'b', 1)",
          [key],
          [],
        );

        await expect(ctx.store.consume(tokenBucket, key, config, 1)).rejects.toThrowError(
          RedisStoreError,
        );

        try {
          await ctx.store.consume(tokenBucket, key, config, 1);
        } catch (err: unknown) {
          expect((err as RedisStoreError).code).toBe('REQNX_CORRUPT_STATE');
        }

        await ctx.store.reset(key);
      });

      it('Treats state with mismatched version as fresh capacity', async () => {
        if (!redisOnline) return;

        const config = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 1,
          refillInterval: '1s',
        });
        const key = `test:tb:version:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        // Version 50 with 0 level
        await ctx.adapter.eval(
          "redis.call('HSET', KEYS[1], 'v', 50, 'l', 0, 'at', 1000, 'a', 1, 'b', 1)",
          [key],
          [],
        );

        const decision = await ctx.store.consume(tokenBucket, key, config, 3);
        expect(decision.allowed).toBe(true);
        expect(decision.remaining).toBe(7);

        await ctx.store.reset(key);
      });

      it('Generative Differential Equivalence (300 fast-check sequences)', async () => {
        if (!redisOnline) return;

        const configArbitrary = fc.record({
          capacity: fc.integer({ min: 1, max: 100 }),
          refillTokens: fc.integer({ min: 1, max: 20 }),
          refillIntervalMs: fc.integer({ min: 100, max: 10_000 }),
        });

        const stepArbitrary = fc.record({
          advanceMs: fc.integer({ min: 0, max: 5_000 }),
          cost: fc.integer({ min: 1, max: 10 }),
        });

        await fc.assert(
          fc.asyncProperty(
            configArbitrary,
            fc.array(stepArbitrary, { minLength: 5, maxLength: 25 }),
            async (cfg, steps) => {
              const config = tokenBucket.parseConfig({
                capacity: cfg.capacity,
                refillTokens: cfg.refillTokens,
                refillInterval: `${cfg.refillIntervalMs}ms`,
              });
              await runDifferentialSequence(
                ctx,
                tokenBucket,
                config,
                steps,
                `test:tb:fc:${adapterType}`,
              );
            },
          ),
          { numRuns: 300 },
        );
      });
    });
  }
});
