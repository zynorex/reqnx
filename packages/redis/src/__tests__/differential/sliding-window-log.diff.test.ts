// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Differential Tests: slidingWindowLog
//
// Proves exact equivalence between @reqnx/core slidingWindowLog and RedisStore Lua port.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { slidingWindowLog } from '@reqnx/core';
import {
  isRedisAvailable,
  setupDifferentialStore,
  runDifferentialSequence,
  assertDecisionMatch,
  neutraliseTtl,
  type DifferentialContext,
} from './harness.js';
import { RedisStoreError } from '../../adapters/base.js';

describe('slidingWindowLog Differential Suite (TypeScript vs Redis Lua)', () => {
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

      it('Golden Case 1: Sequential requests and sliding expiry', async () => {
        if (!redisOnline) return;

        const config = slidingWindowLog.parseConfig({ limit: 4, window: '10s' });
        const steps = [
          { advanceMs: 0, cost: 2 },
          { advanceMs: 2000, cost: 1 },
          { advanceMs: 2000, cost: 1 }, // 4 total admitted -> full
          { advanceMs: 1000, cost: 1 }, // denied
          { advanceMs: 6000, cost: 1 }, // at 11s, first 2 tokens (at 0s) expired -> admitted
        ];

        await runDifferentialSequence(
          ctx,
          slidingWindowLog,
          config,
          steps,
          `test:swl:golden1:${adapterType}`,
        );
      });

      it('Golden Case 2: Denied requests never write state and never touch TTL', async () => {
        if (!redisOnline) return;

        const config = slidingWindowLog.parseConfig({ limit: 5, window: '20s' });
        const key = `test:swl:denied:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(slidingWindowLog);

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

      it('Golden Case 3: Backwards clock protection', async () => {
        if (!redisOnline) return;

        const config = slidingWindowLog.parseConfig({ limit: 5, window: '10s' });
        const key = `test:swl:backwards:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(slidingWindowLog);

        ctx.clock.set(1_000_000);
        await ctx.store.consume(wrappedAlgo, key, config, 2);

        // Clock moves backwards by 500ms
        ctx.clock.set(999_500);

        const expected = slidingWindowLog.step(
          { logs: [{ timestamp: 1_000_000, cost: 2 }] },
          config,
          999_500,
          1,
        );
        const actual = await ctx.store.consume(wrappedAlgo, key, config, 1);

        assertDecisionMatch(actual, expected.decision, 'Backwards clock check');

        await ctx.store.reset(key);
      });

      it('Handles corrupt member in sorted set by raising REQNX_CORRUPT_STATE StoreError', async () => {
        if (!redisOnline) return;

        const config = slidingWindowLog.parseConfig({ limit: 10, window: '10s' });
        const key = `test:swl:corrupt:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        // Write corrupt unparseable member into ZSET
        await ctx.adapter.eval(
          "redis.call('ZADD', KEYS[1], 1000, 'CORRUPT_MEMBER_STRING')",
          [key],
          [],
        );

        await expect(ctx.store.consume(slidingWindowLog, key, config, 1)).rejects.toThrowError(
          RedisStoreError,
        );

        try {
          await ctx.store.consume(slidingWindowLog, key, config, 1);
        } catch (err: unknown) {
          expect((err as RedisStoreError).code).toBe('REQNX_CORRUPT_STATE');
        }

        await ctx.store.reset(key);
      });

      it('Generative Differential Equivalence (300 fast-check sequences)', async () => {
        if (!redisOnline) return;

        const configArbitrary = fc.record({
          limit: fc.integer({ min: 1, max: 50 }),
          windowMs: fc.integer({ min: 500, max: 30_000 }),
        });

        const stepArbitrary = fc.record({
          advanceMs: fc.integer({ min: 0, max: 8_000 }),
          cost: fc.integer({ min: 1, max: 5 }),
        });

        await fc.assert(
          fc.asyncProperty(
            configArbitrary,
            fc.array(stepArbitrary, { minLength: 5, maxLength: 20 }),
            async (cfg, steps) => {
              const config = slidingWindowLog.parseConfig({
                limit: cfg.limit,
                window: `${cfg.windowMs}ms`,
              });
              await runDifferentialSequence(
                ctx,
                slidingWindowLog,
                config,
                steps,
                `test:swl:fc:${adapterType}`,
              );
            },
          ),
          { numRuns: 300 },
        );
      });
    });
  }
});
