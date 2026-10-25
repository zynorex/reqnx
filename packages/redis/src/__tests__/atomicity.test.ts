// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — High-Concurrency Atomicity Test
//
// 8 distinct client instances firing 125 concurrent requests each (1,000 concurrent
// requests) against limits of 20 and 100.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from 'redis';
import Redis from 'ioredis';
import {
  fixedWindow,
  tokenBucket,
  slidingWindowLog,
  slidingWindowCounter,
  type Algorithm,
} from '@reqnx/core';
import { createNodeRedisAdapter } from '../adapters/node-redis.js';
import { createIORedisAdapter } from '../adapters/ioredis.js';
import { createRedisStore } from '../store.js';
import { isRedisAvailable, REDIS_URL } from './differential/harness.js';

describe('High-Concurrency Atomicity (1,000 Concurrent Calls)', () => {
  let redisOnline = false;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) {
      console.warn('⚠️  Redis server is not reachable. Atomicity tests will skip in local dev.');
    }
  });

  const runAtomicityTest = async <C, S>(
    adapterType: 'node-redis' | 'ioredis',
    algo: Algorithm<C, S>,
    config: C,
    limit: number,
  ) => {
    if (!redisOnline) return;

    const numClients = 8;
    const callsPerClient = 125;
    const totalCalls = numClients * callsPerClient; // 1,000
    const key = `atomicity:${algo.id}:${adapterType}:${limit}:${Math.random().toString(36).slice(2, 8)}`;

    // Create 8 distinct client instances
    const stores: ReturnType<typeof createRedisStore>[] = [];
    const rawClients: Array<{ quit?: () => Promise<unknown>; disconnect?: () => void }> = [];

    for (let i = 0; i < numClients; i++) {
      if (adapterType === 'node-redis') {
        const client = createClient({ url: REDIS_URL, socket: { reconnectStrategy: false } });
        await client.connect();
        rawClients.push(client);
        stores.push(createRedisStore({ client: createNodeRedisAdapter(client) }));
      } else {
        const client = new (
          Redis as unknown as {
            new (
              url: string,
              opts?: unknown,
            ): Parameters<typeof createIORedisAdapter>[0] & {
              quit?: () => Promise<unknown>;
              disconnect?: () => void;
            };
          }
        )(REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null });
        rawClients.push(client);
        stores.push(createRedisStore({ client: createIORedisAdapter(client) }));
      }
    }

    try {
      // Fire 1,000 concurrent requests across the 8 clients
      const promises: Promise<boolean>[] = [];
      for (let c = 0; c < numClients; c++) {
        const store = stores[c]!;
        for (let r = 0; r < callsPerClient; r++) {
          promises.push(store.consume(algo, key, config, 1).then((d) => d.allowed));
        }
      }

      const results = await Promise.all(promises);
      const allowedCount = results.filter(Boolean).length;
      const deniedCount = results.filter((x) => !x).length;

      expect(allowedCount).toBe(limit);
      expect(deniedCount).toBe(totalCalls - limit);
    } finally {
      // Cleanup key and close clients
      if (stores.length > 0) {
        await stores[0]!.reset(key);
      }
      for (const s of stores) {
        await s.close();
      }
      for (const r of rawClients) {
        try {
          if (typeof r.quit === 'function') await r.quit();
          else if (typeof r.disconnect === 'function') r.disconnect();
        } catch {}
      }
    }
  };

  const limits = [20, 100];
  const adapters = ['node-redis', 'ioredis'] as const;

  for (const adapter of adapters) {
    describe(`Adapter: ${adapter}`, () => {
      for (const limit of limits) {
        it(`fixedWindow (limit ${limit}) admits exactly ${limit} of 1,000`, async () => {
          const config = fixedWindow.parseConfig({ limit, window: '30s' });
          await runAtomicityTest(adapter, fixedWindow, config, limit);
        });

        it(`tokenBucket (capacity ${limit}) admits exactly ${limit} of 1,000`, async () => {
          const config = tokenBucket.parseConfig({
            capacity: limit,
            refillTokens: 1,
            refillInterval: '1m',
          });
          await runAtomicityTest(adapter, tokenBucket, config, limit);
        });

        it(`slidingWindowLog (limit ${limit}) admits exactly ${limit} of 1,000`, async () => {
          const config = slidingWindowLog.parseConfig({ limit, window: '30s' });
          await runAtomicityTest(adapter, slidingWindowLog, config, limit);
        });

        it(`slidingWindowCounter (limit ${limit}) admits exactly ${limit} of 1,000`, async () => {
          const config = slidingWindowCounter.parseConfig({ limit, window: '30s' });
          await runAtomicityTest(adapter, slidingWindowCounter, config, limit);
        });
      }
    });
  }
});
