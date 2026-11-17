// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Chaos Tests: Outage & Fail-Open / Fail-Closed
//
// Verifies limiter behavior when Redis is unreachable, refused, reset, or blackholed,
// confirming degraded decision marks, deadline adherence, and post-outage recovery.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createLimiter, fixedWindow } from '@reqnx/core';
import Redis from 'ioredis';
import { ChaosProxy } from '../../../test/support/chaos-proxy.js';
import { createIORedisAdapter } from '../../adapters/ioredis.js';
import { createRedisStore } from '../../store.js';
import { isRedisAvailable } from '../differential/harness.js';

describe('Chaos Engineering: Outage, Fail-Open/Fail-Closed & Recovery', () => {
  let redisOnline = false;
  let proxy: ChaosProxy;
  let proxyPort: number;

  beforeAll(async () => {
    redisOnline = await isRedisAvailable();
    if (!redisOnline) return;

    proxy = new ChaosProxy({ upstreamPort: 6379, upstreamHost: '127.0.0.1' });
    proxyPort = await proxy.start();
  });

  afterAll(async () => {
    if (proxy) {
      await proxy.close();
    }
  });

  beforeEach(async () => {
    if (proxy) {
      await proxy.restore();
      proxy.setMode('pass');
    }
  });

  function createTestClient(port: number) {
    const client = new (
      Redis as unknown as {
        new (
          url: string,
          opts?: unknown,
        ): Parameters<typeof createIORedisAdapter>[0] & {
          disconnect?: () => void;
          quit?: () => Promise<unknown>;
          status?: string;
          on: (event: string, handler: (...args: unknown[]) => void) => void;
          once: (event: string, handler: (...args: unknown[]) => void) => void;
          removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
        };
      }
    )(`redis://127.0.0.1:${port}`, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      connectTimeout: 500,
      enableOfflineQueue: false,
    });
    // Suppress unhandled error log events during chaos tests
    client.on('error', () => {});
    return client;
  }

  async function createReadyClient(port: number) {
    const client = createTestClient(port);
    if (client.status !== 'ready') {
      await new Promise<void>((resolve) => {
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); resolve(); };
        const cleanup = () => {
          client.removeListener('ready', onReady);
          client.removeListener('error', onError);
        };
        client.on('ready', onReady);
        client.on('error', onError);
      });
    }
    return client;
  }

  it('Fail-Open Policy: Returns degraded allowed decision under refused connection within deadline', async () => {
    if (!redisOnline) return;

    proxy.setMode('refuse');

    const client = createTestClient(proxyPort);
    const store = createRedisStore({
      client: createIORedisAdapter(client),
      timeoutMs: 150,
    });

    const limiter = createLimiter({
      prefix: 'chaos',
      store,
      algorithm: fixedWindow,
      config: { limit: 10, window: '10s' },
      onStoreError: 'fail-open',
    });

    const start = Date.now();
    const decision = await limiter.check('user1', { cost: 1 });
    const elapsed = Date.now() - start;

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
    expect(elapsed).toBeLessThan(400);

    const stats = store.stats();
    expect(stats.errors.connection).toBeGreaterThanOrEqual(1);

    await store.close();
    await client.quit?.().catch(() => {});
    await proxy.restore();
  });

  it('Fail-Closed Policy: Returns degraded denied decision under refused connection within deadline', async () => {
    if (!redisOnline) return;

    proxy.setMode('refuse');

    const client = createTestClient(proxyPort);
    const store = createRedisStore({
      client: createIORedisAdapter(client),
      timeoutMs: 150,
    });

    const limiter = createLimiter({
      prefix: 'chaos',
      store,
      algorithm: fixedWindow,
      config: { limit: 10, window: '10s' },
      onStoreError: 'fail-closed',
    });

    const start = Date.now();
    const decision = await limiter.check('userClosed', { cost: 1 });
    const elapsed = Date.now() - start;

    expect(decision.allowed).toBe(false);
    expect(decision.degraded).toBe(true);
    expect(elapsed).toBeLessThan(400);

    await store.close();
    await client.quit?.().catch(() => {});
    await proxy.restore();
  });

  it('Blackhole Outage: Call times out strictly at timeoutMs and fails open with degraded mark', async () => {
    if (!redisOnline) return;

    const client = await createReadyClient(proxyPort);
    const timeoutMs = 150;
    const store = createRedisStore({
      client: createIORedisAdapter(client),
      timeoutMs,
    });

    // Inject downstream blackhole
    proxy.setMode('blackhole', { direction: 'downstream' });

    const limiter = createLimiter({
      prefix: 'chaos',
      store,
      algorithm: fixedWindow,
      config: { limit: 10, window: '10s' },
      onStoreError: 'fail-open',
    });

    const start = Date.now();
    const decision = await limiter.check('userBlackhole', { cost: 1 });
    const elapsed = Date.now() - start;

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(timeoutMs - 25);
    expect(elapsed).toBeLessThan(timeoutMs + 250);

    const stats = store.stats();
    expect(stats.timeouts).toBeGreaterThanOrEqual(1);
    expect(stats.errors.timeout).toBeGreaterThanOrEqual(1);

    await store.close();
    await client.quit?.().catch(() => {});
    proxy.setMode('pass');
  });

  it('Circuit Breaker Recovery: Trips open under outage, fast-fails at 0ms, recovers after cooldown', async () => {
    if (!redisOnline) return;

    proxy.setMode('refuse');

    const client = createTestClient(proxyPort);
    const store = createRedisStore({
      client: createIORedisAdapter(client),
      timeoutMs: 100,
      circuitBreaker: {
        failureThreshold: 3,
        windowMs: 5000,
        cooldownMs: 150,
        halfOpenProbes: 1,
      },
    });

    const limiter = createLimiter({
      prefix: 'chaos',
      store,
      algorithm: fixedWindow,
      config: { limit: 10, window: '10s' },
      onStoreError: 'fail-open',
    });

    // 1. Trigger 3 failures to trip the circuit breaker
    for (let i = 0; i < 3; i++) {
      const d = await limiter.check('cbtrip', { cost: 1 });
      expect(d.degraded).toBe(true);
    }

    expect(store.stats().circuitState).toBe('open');

    // 2. Next call fast-fails via circuit breaker in ~0ms
    const fastStart = Date.now();
    const fastDecision = await limiter.check('cbtrip', { cost: 1 });
    const fastElapsed = Date.now() - fastStart;

    expect(fastDecision.degraded).toBe(true);
    expect(fastElapsed).toBeLessThan(25);
    expect(store.stats().errors.circuitOpen).toBeGreaterThanOrEqual(1);

    // 3. Restore proxy to pass mode
    await proxy.restore();
    proxy.setMode('pass');

    // 4. Wait for cooldown period (150ms)
    await new Promise((r) => setTimeout(r, 200));

    // Reconnect client to restored proxy
    await (client as unknown as { connect: () => Promise<void> }).connect().catch(() => {});

    // 5. Half-open probe succeeds and closes the breaker
    const probeDecision = await limiter.check(`cbrecovered${Date.now()}`, { cost: 1 });
    expect(probeDecision.degraded).toBe(false);
    expect(probeDecision.allowed).toBe(true);
    expect(store.stats().circuitState).toBe('closed');

    await store.close();
    await client.quit?.().catch(() => {});
  });

  it('Health Check Ping: Accurately reflects outage and recovery', async () => {
    if (!redisOnline) return;

    proxy.setMode('refuse');

    const client = createTestClient(proxyPort);
    const store = createRedisStore({
      client: createIORedisAdapter(client),
      timeoutMs: 100,
    });

    const downPing = await store.ping();
    expect(downPing.ok).toBe(false);
    expect(downPing.code).toBeDefined();

    await proxy.restore();
    proxy.setMode('pass');

    const freshClient = await createReadyClient(proxyPort);
    const freshStore = createRedisStore({
      client: createIORedisAdapter(freshClient),
      timeoutMs: 500,
    });

    const upPing = await freshStore.ping();
    expect(upPing.ok).toBe(true);
    expect(upPing.latencyMs).toBeGreaterThanOrEqual(0);

    await store.close();
    await freshStore.close();
    await client.quit?.().catch(() => {});
    await freshClient.quit?.().catch(() => {});
  });
});
    await freshStore.close();
    await client.quit?.().catch(() => {});
    await freshClient.quit?.().catch(() => {});
  });
});
