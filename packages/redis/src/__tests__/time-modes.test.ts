// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Time Modes & Server TIME Rejection Test
//
// Verifies default server TIME, pre-call timeMode, explicit clock, and actionable
// REQNX_TIME_REJECTED error handling.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient } from 'redis';
import { fixedWindow } from '@reqnx/core';
import { FakeClock } from '@reqnx/testkit';
import { createNodeRedisAdapter } from '../adapters/node-redis.js';
import { createRedisStore } from '../store.js';
import { RedisStoreError } from '../adapters/base.js';
import { isRedisAvailable, REDIS_URL } from './differential/harness.js';

describe('Time Modes & Server TIME Rejection', () => {
  let redisOnline = false;
  let rawClient: ReturnType<typeof createClient>;
  let adapter: ReturnType<typeof createNodeRedisAdapter>;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) {
      console.warn('⚠️  Redis server is not reachable. Time-modes tests will skip in local dev.');
      return;
    }

    rawClient = createClient({ url: REDIS_URL, socket: { reconnectStrategy: false } });
    await rawClient.connect();
    adapter = createNodeRedisAdapter(rawClient);
  });

  afterAll(async () => {
    if (rawClient) await rawClient.quit();
  });

  it('Default server time mode executes redis.call("TIME") inside script', async () => {
    if (!redisOnline) return;

    const store = createRedisStore({ client: adapter, timeMode: 'server' });
    const config = fixedWindow.parseConfig({ limit: 10, window: '10s' });
    const key = `test:time:server:${Math.random().toString(36).slice(2, 8)}`;

    const decision = await store.consume(fixedWindow, key, config, 1);
    expect(decision.allowed).toBe(true);
    expect(decision.resetAtMs).toBeGreaterThan(1_700_000_000_000); // realistic epoch timestamp

    await store.reset(key);
  });

  it('pre-call time mode fetches server time prior to script execution', async () => {
    if (!redisOnline) return;

    const store = createRedisStore({ client: adapter, timeMode: 'pre-call' });
    const config = fixedWindow.parseConfig({ limit: 10, window: '10s' });
    const key = `test:time:precall:${Math.random().toString(36).slice(2, 8)}`;

    const decision = await store.consume(fixedWindow, key, config, 1);
    expect(decision.allowed).toBe(true);
    expect(decision.resetAtMs).toBeGreaterThan(1_700_000_000_000);

    await store.reset(key);
  });

  it('Explicit clock injects client timestamp into Lua script', async () => {
    if (!redisOnline) return;

    const fakeClock = new FakeClock(1_234_567_000);
    const store = createRedisStore({ client: adapter, clock: fakeClock });
    const config = fixedWindow.parseConfig({ limit: 5, window: '10s' });
    const key = `test:time:clock:${Math.random().toString(36).slice(2, 8)}`;

    const decision = await store.consume(fixedWindow, key, config, 1);
    expect(decision.allowed).toBe(true);
    // Window start for 1_234_567_000 with 10_000 windowMs is 1_234_560_000; resetAt is 1_234_570_000
    expect(decision.resetAtMs).toBe(1_234_570_000);

    await store.reset(key);
  });

  it('Maps server TIME rejection inside script to REQNX_TIME_REJECTED with remediation message', async () => {
    // Test mapping directly on mapRedisError with simulated rejection message
    const { mapRedisError } = await import('../adapters/base.js');
    const simulatedError = new Error(
      'ERR Error running script: REQNX_TIME_REJECTED: server rejected redis.call("TIME") inside Lua script',
    );

    const mapped = mapRedisError(simulatedError);
    expect(mapped).toBeInstanceOf(RedisStoreError);
    expect(mapped.code).toBe('REQNX_TIME_REJECTED');
    expect(mapped.message).toContain(
      "Configure timeMode: 'pre-call' or provide an explicit synchronized Clock",
    );
  });
});
