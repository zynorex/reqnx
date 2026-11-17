// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Differential Tests: leakyBucket
//
// Proves exact equivalence between @reqnx/core leakyBucket, RedisStore Lua port,
// and tokenBucket over identical sequences, plus namespace key isolation.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { leakyBucket, tokenBucket } from '@reqnx/core';
import {
  isRedisAvailable,
  setupDifferentialStore,
  runDifferentialSequence,
  neutraliseTtl,
  type DifferentialContext,
} from './harness.js';

describe('leakyBucket Differential Suite (TypeScript vs Redis Lua)', () => {
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

        const config = leakyBucket.parseConfig({
          capacity: 5,
          leak: 1,
          interval: '1s',
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
          leakyBucket,
          config,
          steps,
          `test:lb:golden1:${adapterType}`,
        );
      });

      it('Golden Case 2: Partial drain and water consumption', async () => {
        if (!redisOnline) return;

        const config = leakyBucket.parseConfig({
          capacity: 10,
          leak: 2,
          interval: '1s',
        });
        const steps = [
          { advanceMs: 0, cost: 8 }, // consumes 8, 2 remaining
          { advanceMs: 1000, cost: 3 }, // leaks 2 -> 4 available room, consumes 3 -> 1 remaining
          { advanceMs: 250, cost: 2 }, // leaks 0 (need 500ms for 1 unit) -> denied
          { advanceMs: 500, cost: 2 }, // leaks 1 -> 2 available room, consumes 2 -> 0 remaining
        ];

        await runDifferentialSequence(
          ctx,
          leakyBucket,
          config,
          steps,
          `test:lb:golden2:${adapterType}`,
        );
      });

      it('Golden Case 3: Extreme cost > capacity is denied without state mutation', async () => {
        if (!redisOnline) return;

        const config = leakyBucket.parseConfig({
          capacity: 5,
          leak: 1,
          interval: '1s',
        });
        const key = `test:lb:extreme:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(leakyBucket);

        // 1. Add 2 units of water (3 units room remaining)
        const d1 = await ctx.store.consume(wrappedAlgo, key, config, 2);
        expect(d1.allowed).toBe(true);
        expect(d1.remaining).toBe(3);

        // 2. Request cost 999 (greater than capacity 5) -> denied
        const d2 = await ctx.store.consume(wrappedAlgo, key, config, 999);
        expect(d2.allowed).toBe(false);
        expect(d2.remaining).toBe(3);

        // 3. State unchanged: 3 room still remaining
        const peek = await ctx.store.peek(wrappedAlgo, key, config);
        expect(peek.remaining).toBe(3);
      });

      it('Redis leaky-bucket vs Redis token-bucket produce identical Decisions on shared sequence', async () => {
        if (!redisOnline) return;

        const lbConfig = leakyBucket.parseConfig({
          capacity: 10,
          leak: 2,
          interval: '1s',
        });
        const tbConfig = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 2,
          refillInterval: '1s',
        });

        const idSuffix = Math.random().toString(36).slice(2, 8);
        const lbKey = `user:shared:lb:${idSuffix}`;
        const tbKey = `user:shared:tb:${idSuffix}`;

        const wrappedLb = neutraliseTtl(leakyBucket);
        const wrappedTb = neutraliseTtl(tokenBucket);

        const costs = [3, 4, 2, 2, 1, 5];
        for (const cost of costs) {
          ctx.clock.advance(150);
          const lbDec = await ctx.store.consume(wrappedLb, lbKey, lbConfig, cost);
          const tbDec = await ctx.store.consume(wrappedTb, tbKey, tbConfig, cost);

          expect(lbDec.allowed).toBe(tbDec.allowed);
          expect(lbDec.limit).toBe(tbDec.limit);
          expect(lbDec.remaining).toBe(tbDec.remaining);
          expect(lbDec.resetAtMs).toBe(tbDec.resetAtMs);
          expect(lbDec.retryAfterMs).toBe(tbDec.retryAfterMs);
        }
      });

      it('Key isolation: state is partitioned by algorithm id and never shares keys', async () => {
        if (!redisOnline) return;

        const lbConfig = leakyBucket.parseConfig({
          capacity: 10,
          leak: 1,
          interval: '1s',
        });
        const tbConfig = tokenBucket.parseConfig({
          capacity: 10,
          refillTokens: 1,
          refillInterval: '1s',
        });

        const identity = `shared-id-${Math.random().toString(36).slice(2, 8)}`;
        const lbKey = `reqnx:rl:${leakyBucket.id}:${identity}`;
        const tbKey = `reqnx:rl:${tokenBucket.id}:${identity}`;
        const wrappedLb = neutraliseTtl(leakyBucket);
        const wrappedTb = neutraliseTtl(tokenBucket);

        // Consume 8 from leaky bucket
        const lbDec = await ctx.store.consume(wrappedLb, lbKey, lbConfig, 8);
        expect(lbDec.remaining).toBe(2);

        // Token bucket with same identity has distinct key and starts FRESH with 10 tokens available
        const tbPeek = await ctx.store.peek(wrappedTb, tbKey, tbConfig);
        expect(tbPeek.remaining).toBe(10);
      });

      it('Fast-Check Random Sequences: TypeScript vs Redis Lua for leaky-bucket', async () => {
        if (!redisOnline) return;

        await fc.assert(
          fc.asyncProperty(
            fc.record({
              capacity: fc.integer({ min: 1, max: 20 }),
              leak: fc.integer({ min: 1, max: 10 }),
              interval: fc.integer({ min: 50, max: 500 }),
            }),
            fc.array(
              fc.record({
                advanceMs: fc.integer({ min: 0, max: 200 }),
                cost: fc.integer({ min: 1, max: 15 }),
              }),
              { minLength: 2, maxLength: 8 },
            ),
            async (cfg, steps) => {
              const config = leakyBucket.parseConfig(cfg);
              const key = `test:lb:prop:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
              await runDifferentialSequence(ctx, leakyBucket, config, steps, key);
            },
          ),
          { numRuns: 15 },
        );
      });
    });
  }
});
