// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Differential Tests: fixedWindow
//
// Proves exact equivalence between @reqnx/core fixedWindow and RedisStore Lua port.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { fixedWindow, StoreError } from '@reqnx/core';
import {
  isRedisAvailable,
  setupDifferentialStore,
  runDifferentialSequence,
  assertDecisionMatch,
  neutraliseTtl,
  type DifferentialContext,
} from './harness.js';
import { RedisStoreError } from '../../src/adapters/base.js';

describe('fixedWindow Differential Suite (TypeScript vs Redis Lua)', () => {
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

      it('Golden Case 1: Countdown to zero (5 calls of cost 1 with limit 5)', async () => {
        if (!redisOnline) return;

        const config = fixedWindow.parseConfig({ limit: 5, window: '1m' });
        const steps = [
          { advanceMs: 0, cost: 1 },
          { advanceMs: 100, cost: 1 },
          { advanceMs: 100, cost: 1 },
          { advanceMs: 100, cost: 1 },
          { advanceMs: 100, cost: 1 },
          { advanceMs: 100, cost: 1 }, // 6th call: denied
        ];

        await runDifferentialSequence(ctx, fixedWindow, config, steps, `test:fw:golden1:${adapterType}`);
      });

      it('Golden Case 2: Rollover to fresh window', async () => {
        if (!redisOnline) return;

        const config = fixedWindow.parseConfig({ limit: 3, window: '10s' });
        const steps = [
          { advanceMs: 0, cost: 2 },
          { advanceMs: 1000, cost: 1 }, // reaches 3
          { advanceMs: 500, cost: 1 },  // rejected
          { advanceMs: 10_000, cost: 2 }, // rolled into fresh window -> accepted
        ];

        await runDifferentialSequence(ctx, fixedWindow, config, steps, `test:fw:golden2:${adapterType}`);
      });

      it('Golden Case 3: Denied requests never write state and never touch TTL', async () => {
        if (!redisOnline) return;

        const config = fixedWindow.parseConfig({ limit: 5, window: '30s' });
        const key = `test:fw:denied:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(fixedWindow);

        // 1. Consume 3 tokens
        const d1 = await ctx.store.consume(wrappedAlgo, key, config, 3);
        expect(d1.allowed).toBe(true);
        expect(d1.remaining).toBe(2);

        // 2. Attempt to consume 5 tokens (cost > remaining) -> should be denied
        const d2 = await ctx.store.consume(wrappedAlgo, key, config, 5);
        expect(d2.allowed).toBe(false);
        expect(d2.remaining).toBe(2);

        // 3. Peek should still see 2 remaining
        const p1 = await ctx.store.peek(wrappedAlgo, key, config);
        expect(p1.remaining).toBe(2);

        // 4. Consume 2 tokens -> should succeed
        const d3 = await ctx.store.consume(wrappedAlgo, key, config, 2);
        expect(d3.allowed).toBe(true);
        expect(d3.remaining).toBe(0);

        await ctx.store.reset(key);
      });

      it('Golden Case 4: Backwards clock monotonicity (NTP jump backwards)', async () => {
        if (!redisOnline) return;

        const config = fixedWindow.parseConfig({ limit: 4, window: '10s' });
        const key = `test:fw:backwards:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;
        const wrappedAlgo = neutraliseTtl(fixedWindow);

        // Current time: 1_000_000 (window: 1_000_000 to 1_010_000)
        ctx.clock.reset(1_000_000);
        const d1 = await ctx.store.consume(wrappedAlgo, key, config, 2);
        expect(d1.allowed).toBe(true);
        expect(d1.remaining).toBe(2);

        // Clock moves backwards by 500ms
        ctx.clock.reset(999_500);

        // Step through TS algorithm to get expected outcome
        const expected = fixedWindow.step({ windowStart: 1_000_000, count: 2 }, config, 999_500, 1);
        const actual = await ctx.store.consume(wrappedAlgo, key, config, 1);

        assertDecisionMatch(actual, expected.decision, 'Backwards clock check');
        expect(actual.remaining).toBe(1);

        await ctx.store.reset(key);
      });

      it('Handles corrupt state by raising REQNX_CORRUPT_STATE StoreError', async () => {
        if (!redisOnline) return;

        const config = fixedWindow.parseConfig({ limit: 10, window: '10s' });
        const key = `test:fw:corrupt:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        // Write corrupt non-numeric count directly into the Redis hash
        await ctx.adapter.eval("redis.call('HSET', KEYS[1], 'v', 1, 'ws', 1000, 'c', 'NOT_A_NUMBER')", [key], []);

        await expect(
          ctx.store.consume(fixedWindow, key, config, 1),
        ).rejects.toThrowError(RedisStoreError);

        try {
          await ctx.store.consume(fixedWindow, key, config, 1);
        } catch (err: any) {
          expect(err.code).toBe('REQNX_CORRUPT_STATE');
        }

        await ctx.store.reset(key);
      });

      it('Treats state with mismatched version as fresh capacity', async () => {
        if (!redisOnline) return;

        const config = fixedWindow.parseConfig({ limit: 10, window: '10s' });
        const key = `test:fw:version:${adapterType}:${Math.random().toString(36).slice(2, 8)}`;

        // Write future version 99 with full count
        await ctx.adapter.eval("redis.call('HSET', KEYS[1], 'v', 99, 'ws', 1000, 'c', 10)", [key], []);

        // Next call should treat state as fresh and admit the request
        const decision = await ctx.store.consume(fixedWindow, key, config, 3);
        expect(decision.allowed).toBe(true);
        expect(decision.remaining).toBe(7);

        await ctx.store.reset(key);
      });

      it('Generative Differential Equivalence (300 fast-check sequences)', async () => {
        if (!redisOnline) return;

        const configArbitrary = fc.record({
          limit: fc.integer({ min: 1, max: 100 }),
          windowMs: fc.integer({ min: 100, max: 60_000 }),
        });

        const stepArbitrary = fc.record({
          advanceMs: fc.integer({ min: 0, max: 15_000 }),
          cost: fc.integer({ min: 1, max: 10 }),
        });

        await fc.assert(
          fc.asyncProperty(
            configArbitrary,
            fc.array(stepArbitrary, { minLength: 5, maxLength: 25 }),
            async (cfg, steps) => {
              const config = fixedWindow.parseConfig({
                limit: cfg.limit,
                window: `${cfg.windowMs}ms`,
              });
              await runDifferentialSequence(ctx, fixedWindow, config, steps, `test:fw:fc:${adapterType}`);
            },
          ),
          { numRuns: 300 },
        );
      });
    });
  }
});
