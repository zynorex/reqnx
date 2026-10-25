// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Store Contract Suite Run
//
// Verifies that RedisStore satisfies the canonical Store contract from @reqnx/testkit.
// ──────────────────────────────────────────────────────────────────────────────

import { beforeAll, describe } from 'vitest';
import { createClient } from 'redis';
import Redis from 'ioredis';
import { fixedWindow } from '@reqnx/core';
import { runStoreContractSuite, type StoreHarness } from '@reqnx/testkit';
import { createRedisStore } from '../store.js';
import { createNodeRedisAdapter } from '../adapters/node-redis.js';
import { createIORedisAdapter } from '../adapters/ioredis.js';
import { isRedisAvailable, REDIS_URL } from './differential/harness.js';

describe('RedisStore Store Contract', () => {
  let redisOnline = false;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) {
      console.warn(
        '⚠️  Redis server is not reachable. Store contract tests will skip in local dev.',
      );
    }
  });

  const nodeRedisHarness: StoreHarness = {
    name: 'RedisStore (node-redis)',
    capabilities: { simulatedTtl: false },
    algorithm: fixedWindow,
    sampleConfig: fixedWindow.parseConfig({ limit: 10, window: '10s' }),
    isAvailable: () => redisOnline,
    async create(options) {
      const rawClient = createClient({ url: REDIS_URL, socket: { reconnectStrategy: false } });
      await rawClient.connect();
      const adapter = createNodeRedisAdapter(rawClient);
      return createRedisStore({ client: adapter, ...(options?.clock ? { clock: options.clock } : {}) });
    },
    async cleanup(store) {
      await store.close();
    },
  };

  const ioRedisHarness: StoreHarness = {
    name: 'RedisStore (ioredis)',
    capabilities: { simulatedTtl: false },
    algorithm: fixedWindow,
    sampleConfig: fixedWindow.parseConfig({ limit: 10, window: '10s' }),
    isAvailable: () => redisOnline,
    async create(options) {
      const rawClient = new (
        Redis as unknown as {
          new (url: string, opts?: unknown): Parameters<typeof createIORedisAdapter>[0];
        }
      )(REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null });
      const adapter = createIORedisAdapter(rawClient);
      return createRedisStore({ client: adapter, ...(options?.clock ? { clock: options.clock } : {}) });
    },
    async cleanup(store) {
      await store.close();
    },
  };

  runStoreContractSuite(nodeRedisHarness);
  runStoreContractSuite(ioRedisHarness);
});
