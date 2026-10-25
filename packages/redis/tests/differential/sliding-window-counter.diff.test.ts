// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Differential Tests: slidingWindowCounter
//
// Proves exact equivalence between @reqnx/core slidingWindowCounter and RedisStore Lua port.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { slidingWindowCounter } from '@reqnx/core';
import {
  isRedisAvailable,
  setupDifferentialStore,
  runDifferentialSequence,
  assertDecisionMatch,
  neutraliseTtl,
  type DifferentialContext,
} from './harness.js';
import { RedisStoreError } from '../../src/adapters/base.js';

describe('slidingWindowCounter Differential Suite (TypeScript vs Redis Lua)', () => {
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

      it('Golden Case 1: Window transition and weighted previous count', async () => {
        if (!redisOnline) return;

        const config = slidingWindowCounter.parseConfig({ limit: 10, window: '10s' });
        const steps = [
          { advanceMs: 0, cost: 8 },      // consumes 8 in window 1
          { advanceMs: 12_500, cost: 2 }, // advances 12.5s into window 2 (25% elapsed, previous weight 75%)
          { advanceMs: 2500, cost: 2 },   // advances to 50% elapsed, previous weight 50%
        ];

        await runDifferentialSequence(ctx, slidingWindowCounter, config, steps, `test:swc:golden1:${adapterType}`);
      });

      it('Golden Case 2: Denied requests never write state and never touch TTL', async () => {
        if (!redisOnline) return;

        const config = slidingWindowCounter.parseConfig({ limit: 5, window: '20s' });
        const key = `test:swc:denied:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(slidingWindowCounter);

        const d1 = await ctx.store.consume(wrappedAlgo, key, config, 3);
        expect(d1.allowed).toBe(true);
        expect(d1.remaining).toBe(2);

        // Denied request
        const d2 = await ctx.store.consume(wrappedAlgo, key, config, 5);
        expect(d2.allowed).toBe(false);
        expect(d2.remaining).toBe(2);

        // Peek should still see 2
        const p1 = await ctx.store.peek(wrappedAlgo, key, config);
        expect(p1.remaining).toBe(2);

        // Valid consumption
        const d3 = await ctx.store.consume(wrappedAlgo, key, config, 2);
        expect(d3.allowed).toBe(true);
        expect(d3.remaining).toBe(0);

        await ctx.store.reset(key);
      });

      it('Golden Case 3: Backwards clock monotonicity', async () => {
        if (!redisOnline) return;

        const config = slidingWindowCounter.parseConfig({ limit: 10, window: '10s' });
        const key = `test:swc:backwards:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(slidingWindowCounter);

        ctx.clock.reset(1_000_000);
        await ctx.store.consume(wrappedAlgo, key, config, 4);

        // Clock moves backwards by 500ms
        ctx.clock.reset(999_500);

        const expected = slidingWindowCounter.step(
          { currentWindowStart: 1_000_000, currentCount: 4, previousCount: 0 },
          config,
          999_500,
          2,
        );
        const actual = await ctx.store.consume(wrappedAlgo, key, config, 2);

        assertDecisionMatch(actual, expected.decision, 'Backwards clock check');

        await ctx.store.reset(key);
      });

      it('Handles corrupt state by raising REQNX_CORRUPT_STATE StoreError', async () => {
        if (!redisOnline) return;

        const config = slidingWindowCounter.parseConfig({ limit: 10, window: '10s' });
        const key = `test:swc:corrupt:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        await ctx.adapter.eval("redis.call('HSET', KEYS[1], 'v', 1, 'ws', 1000, 'cc', 'BAD', 'pc', 0)", [key], []);

        await expect(
          ctx.store.consume(slidingWindowCounter, key, config, 1),
        ).rejects.toThrowError(RedisStoreError);

        try {
          await ctx.store.consume(slidingWindowCounter, key, config, 1);
        } catch (err: any) {
          expect(err.code).toBe('REQNX_CORRUPT_STATE');
        }

        await ctx.store.reset(key);
      });

      it('Treats state with mismatched version as fresh capacity', async () => {
        if (!redisOnline) return;

        const config = slidingWindowCounter.parseConfig({ limit: 10, window: '10s' });
        const key = `test:swc:version:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        // Version 12 with full count
        await ctx.adapter.eval("redis.call('HSET', KEYS[1], 'v', 12, 'ws', 1000, 'cc', 10, 'pc', 10)", [key], []);

        const decision = await ctx.store.consume(slidingWindowCounter, key, config, 3);
        expect(decision.allowed).toBe(true);
        expect(decision.remaining).toBe(7);

        await ctx.store.reset(key);
      });

      it('Generative Differential Equivalence (300 fast-check sequences)', async () => {
        if (!redisOnline) return;

        const configArbitrary = fc.record({
          limit: fc.integer({ min: 1, max: 100 }),
          windowMs: fc.integer({ min: 1000, max: 60_000 }),
        });

        const stepArbitrary = fc.record({
          advanceMs: fc.integer({ min: 0, max: 20_000 }),
          cost: fc.integer({ min: 1, max: 10 }),
        });

        await fc.assert(
          fc.asyncProperty(
            configArbitrary,
            fc.array(stepArbitrary, { minLength: 5, maxLength: 20 }),
            async (cfg, steps) => {
              const config = slidingWindowCounter.parseConfig({
                limit: cfg.limit,
                window: `${cfg.windowMs}ms`,
              });
              await runDifferentialSequence(ctx, slidingWindowCounter, config, steps, `test:swc:fc:${adapterType}`);
            },
          ),
          { numRuns: 300 },
        );
      });
    });
  }
});
