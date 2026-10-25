// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — TTL Correctness & Peek Purity Tests
//
// Verifies real server PTTL, denied request zero-write invariant, peek purity,
// and WRONGTYPE error handling.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient } from 'redis';
import { fixedWindow, tokenBucket, slidingWindowCounter } from '@reqnx/core';
import { createNodeRedisAdapter } from '../adapters/node-redis.js';
import { createRedisStore } from '../store.js';
import { RedisStoreError } from '../adapters/base.js';
import { isRedisAvailable, REDIS_URL } from './differential/harness.js';

describe('TTL Correctness, Zero-Write Invariant & Peek Purity', () => {
  let redisOnline = false;
  let rawClient: ReturnType<typeof createClient>;
  let adapter: ReturnType<typeof createNodeRedisAdapter>;
  let store: ReturnType<typeof createRedisStore>;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) {
      console.warn('⚠️  Redis server is not reachable. TTL tests will skip in local dev.');
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

  it('Verifies real Redis PTTL for fixedWindow, tokenBucket, and slidingWindowCounter', async () => {
    if (!redisOnline) return;

    // 1. fixedWindow: TTL should be windowMs
    const fwConfig = fixedWindow.parseConfig({ limit: 10, window: '5s' });
    const fwKey = `test:ttl:fw:${Math.random().toString(36).slice(2, 8)}`;
    await store.consume(fixedWindow, fwKey, fwConfig, 1);
    const fwPttl = await rawClient.pTTL(fwKey);
    expect(fwPttl).toBeGreaterThan(0);
    expect(fwPttl).toBeLessThanOrEqual(5000);
    await store.reset(fwKey);

    // 2. tokenBucket: TTL should be fullRefillMs
    const tbConfig = tokenBucket.parseConfig({
      capacity: 5,
      refillTokens: 1,
      refillInterval: '2s',
    });
    const tbKey = `test:ttl:tb:${Math.random().toString(36).slice(2, 8)}`;
    await store.consume(tokenBucket, tbKey, tbConfig, 1);
    const tbPttl = await rawClient.pTTL(tbKey);
    expect(tbPttl).toBeGreaterThan(0);
    expect(tbPttl).toBeLessThanOrEqual(tbConfig.fullRefillMs);
    await store.reset(tbKey);

    // 3. slidingWindowCounter: TTL should be 2 * windowMs
    const swcConfig = slidingWindowCounter.parseConfig({ limit: 10, window: '4s' });
    const swcKey = `test:ttl:swc:${Math.random().toString(36).slice(2, 8)}`;
    await store.consume(slidingWindowCounter, swcKey, swcConfig, 1);
    const swcPttl = await rawClient.pTTL(swcKey);
    expect(swcPttl).toBeGreaterThan(4000);
    expect(swcPttl).toBeLessThanOrEqual(8000);
    await store.reset(swcKey);
  });

  it('Denied request on non-existent key writes zero state and sets zero TTL', async () => {
    if (!redisOnline) return;

    const config = fixedWindow.parseConfig({ limit: 5, window: '10s' });
    const key = `test:ttl:denied-clean:${Math.random().toString(36).slice(2, 8)}`;

    // Attempt request exceeding limit (cost = 10 > limit = 5)
    const decision = await store.consume(fixedWindow, key, config, 10);
    expect(decision.allowed).toBe(false);

    // Verify key DOES NOT EXIST in Redis
    const exists = await rawClient.exists(key);
    expect(exists).toBe(0);

    const pttl = await rawClient.pTTL(key);
    expect(pttl).toBe(-2); // -2 in Redis indicates key does not exist
  });

  it('Peek on clean or active key mutates zero state and zero TTL', async () => {
    if (!redisOnline) return;

    const config = fixedWindow.parseConfig({ limit: 5, window: '10s' });
    const cleanKey = `test:ttl:peek-clean:${Math.random().toString(36).slice(2, 8)}`;

    // 1. Peek on clean key
    const p1 = await store.peek(fixedWindow, cleanKey, config);
    expect(p1.allowed).toBe(true);
    expect(await rawClient.exists(cleanKey)).toBe(0);

    // 2. Consume 2 tokens on active key
    const activeKey = `test:ttl:peek-active:${Math.random().toString(36).slice(2, 8)}`;
    await store.consume(fixedWindow, activeKey, config, 2);
    const initialTtl = await rawClient.pTTL(activeKey);

    // 3. Peek on active key
    const p2 = await store.peek(fixedWindow, activeKey, config);
    expect(p2.remaining).toBe(3);

    const postPeekTtl = await rawClient.pTTL(activeKey);
    expect(postPeekTtl).toBeLessThanOrEqual(initialTtl);

    await store.reset(activeKey);
  });

  it('Handles WRONGTYPE key by raising REQNX_WRONGTYPE StoreError', async () => {
    if (!redisOnline) return;

    const config = fixedWindow.parseConfig({ limit: 5, window: '10s' });
    const wrongKey = `test:ttl:wrongtype:${Math.random().toString(36).slice(2, 8)}`;

    // Create a plain Redis string at this key
    await rawClient.set(wrongKey, 'I_AM_A_STRING_NOT_A_HASH');

    try {
      await store.consume(fixedWindow, wrongKey, config, 1);
      expect.fail('Should have thrown StoreError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(RedisStoreError);
      expect((err as RedisStoreError).code).toBe('REQNX_WRONGTYPE');
    }

    await rawClient.del(wrongKey);
  });
});
