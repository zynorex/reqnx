// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Differential Test Harness
//
// Replays sequences against pure TypeScript algorithms and RedisStore,
// verifying exact decision matching step by step.
// ──────────────────────────────────────────────────────────────────────────────

import { expect } from 'vitest';
import { type Algorithm, type Decision } from '@reqnx/core';
import { FakeClock } from '@reqnx/testkit';
import { createClient } from 'redis';
import Redis from 'ioredis';
import { createNodeRedisAdapter } from '../../adapters/node-redis.js';
import { createIORedisAdapter } from '../../adapters/ioredis.js';
import { createRedisStore } from '../../store.js';
import { type RedisClientAdapter, type RedisStore } from '../../types.js';

export const REDIS_URL = process.env['REDIS_URL'] || 'redis://127.0.0.1:6379';

let cachedAvailability: boolean | null = null;

/**
 * Check whether a Redis server is reachable at REDIS_URL.
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) {
    return cachedAvailability;
  }

  const client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: false,
    },
  });

  try {
    await client.connect();
    await client.ping();
    await client.quit();
    cachedAvailability = true;
    return true;
  } catch {
    cachedAvailability = false;
    return false;
  }
}

/**
 * Context for a single differential test run.
 */
export interface DifferentialContext {
  adapter: RedisClientAdapter;
  store: RedisStore;
  clock: FakeClock;
  cleanup: () => Promise<void>;
}

/**
 * Setup a test store with an explicit FakeClock and isolated keyspace.
 */
export async function setupDifferentialStore(
  adapterType: 'node-redis' | 'ioredis',
  initialTimeMs: number = 1_000_000,
): Promise<DifferentialContext> {
  const clock = new FakeClock(initialTimeMs);

  let adapter: RedisClientAdapter;

  if (adapterType === 'node-redis') {
    const nodeClient = createClient({
      url: REDIS_URL,
      socket: { reconnectStrategy: false },
    });
    await nodeClient.connect();
    adapter = createNodeRedisAdapter(nodeClient);
  } else {
    const ioClient = new (
      Redis as unknown as {
        new (
          url: string,
          opts?: unknown,
        ): Parameters<typeof createIORedisAdapter>[0] & {
          disconnect?: () => void;
          quit?: () => Promise<unknown>;
        };
      }
    )(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    adapter = createIORedisAdapter(ioClient);
  }

  const store = createRedisStore({
    client: adapter,
    clock,
  });

  const cleanup = async () => {
    try {
      await store.close();
    } catch {}
    try {
      await adapter.close();
    } catch {}
  };

  return { adapter, store, clock, cleanup };
}

/**
 * Wrap an algorithm to return a very large stateTtlMs during differential tests,
 * preventing real-time Redis TTL eviction during simulated clock leaps.
 */
export function neutraliseTtl<C, S>(algorithm: Algorithm<C, S>): Algorithm<C, S> {
  return {
    ...algorithm,
    stateTtlMs: () => 86_400_000, // 24 hours
  };
}

/**
 * Run a differential replay of (advanceMs, cost) steps against pure TS and Redis Lua.
 */
export async function runDifferentialSequence<C, S>(
  context: DifferentialContext,
  algorithm: Algorithm<C, S>,
  config: C,
  steps: readonly { readonly advanceMs: number; readonly cost: number }[],
  keyPrefix: string = 'test:diff',
): Promise<void> {
  const key = `${keyPrefix}:${Math.random().toString(36).slice(2, 9)}`;
  const wrappedAlgo = neutraliseTtl(algorithm);

  let tsState: S | undefined = undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.advanceMs > 0) {
      context.clock.advance(step.advanceMs);
    }
    const nowMs = context.clock.nowMs();

    // 1. Differential check on peek()
    const expectedPeek = algorithm.peek(tsState, config, nowMs);
    const actualPeek = await context.store.peek(wrappedAlgo, key, config);

    assertDecisionMatch(actualPeek, expectedPeek, `Step ${i} peek mismatch at nowMs=${nowMs}`);

    // 2. Differential check on consume() / step()
    const { decision: expectedDecision, nextState } = algorithm.step(
      tsState,
      config,
      nowMs,
      step.cost,
    );
    const actualDecision = await context.store.consume(wrappedAlgo, key, config, step.cost);

    assertDecisionMatch(
      actualDecision,
      expectedDecision,
      `Step ${i} consume mismatch at nowMs=${nowMs}, cost=${step.cost}`,
    );

    tsState = nextState;
  }

  // Teardown key
  await context.store.reset(key);
}

export function assertDecisionMatch(
  actual: Decision,
  expected: Decision,
  contextMsg: string,
): void {
  expect(actual.allowed, `${contextMsg} (allowed)`).toBe(expected.allowed);
  expect(actual.limit, `${contextMsg} (limit)`).toBe(expected.limit);
  expect(actual.remaining, `${contextMsg} (remaining)`).toBe(expected.remaining);
  expect(actual.resetAtMs, `${contextMsg} (resetAtMs)`).toBe(expected.resetAtMs);
  expect(actual.retryAfterMs, `${contextMsg} (retryAfterMs)`).toBe(expected.retryAfterMs);
  expect(actual.degraded, `${contextMsg} (degraded)`).toBe(expected.degraded);
}
