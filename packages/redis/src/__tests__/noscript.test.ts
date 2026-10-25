// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — NOSCRIPT & SCRIPT FLUSH Resilience Test
//
// Verifies self-healing script runner fallback from EVALSHA to EVAL on NOSCRIPT.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient } from 'redis';
import { fixedWindow } from '@reqnx/core';
import { createNodeRedisAdapter } from '../adapters/node-redis.js';
import { createRedisStore } from '../store.js';
import { isRedisAvailable, REDIS_URL } from './differential/harness.js';

describe('NOSCRIPT & SCRIPT FLUSH Resilience', () => {
  let redisOnline = false;
  let rawClient: ReturnType<typeof createClient>;
  let adapter: ReturnType<typeof createNodeRedisAdapter>;
  let store: ReturnType<typeof createRedisStore>;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) {
      console.warn('⚠️  Redis server is not reachable. NOSCRIPT tests will skip in local dev.');
      return;
    }

    rawClient = createClient({ url: REDIS_URL, socket: { reconnectStrategy: false } });
    await rawClient.connect();
    adapter = createNodeRedisAdapter(rawClient);
    store = createRedisStore({ client: adapter });
  });

  afterAll(async () => {
    if (store) await store.close();
    if (rawClient) await rawClient.quit();
  });

  it('Transparently recovers from SCRIPT FLUSH via automatic EVAL fallback', async () => {
    if (!redisOnline) return;

    const config = fixedWindow.parseConfig({ limit: 10, window: '10s' });
    const key = `test:noscript:${Math.random().toString(36).slice(2, 8)}`;

    // 1. Initial consume loads script into Redis cache
    const d1 = await store.consume(fixedWindow, key, config, 1);
    expect(d1.allowed).toBe(true);

    const initialStats = store.stats();
    expect(initialStats.evalshaCalls).toBeGreaterThanOrEqual(1);

    // 2. Clear Redis Lua script cache with SCRIPT FLUSH
    await rawClient.scriptFlush();

    // 3. Next consume encounters NOSCRIPT on evalSha, catches it, transparently falls back to eval
    const d2 = await store.consume(fixedWindow, key, config, 1);
    expect(d2.allowed).toBe(true);
    expect(d2.remaining).toBe(8);

    const postFlushStats = store.stats();
    expect(postFlushStats.evalFallbacks).toBeGreaterThan(initialStats.evalFallbacks);

    // 4. Verify warmup() preloads scripts
    await rawClient.scriptFlush();
    await store.warmup();

    // After warmup, evalSha should succeed without fallback
    const fallbacksBefore = store.stats().evalFallbacks;
    const d3 = await store.consume(fixedWindow, key, config, 1);
    expect(d3.allowed).toBe(true);
    expect(store.stats().evalFallbacks).toBe(fallbacksBefore);

    await store.reset(key);
  });
});
