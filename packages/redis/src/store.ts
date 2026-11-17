// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — RedisStore Implementation
//
// Atomic rate limiter store executing algorithm Lua scripts on Redis.
// Hardened with timeout bounds, in-flight bulkhead, and circuit breaker.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type Clock, type Decision } from '@reqnx/core';
import {
  type AlgorithmRedisPort,
  type RedisClientAdapter,
  type RedisStore,
  type RedisStoreOptions,
  type RedisStoreStats,
  type RedisTimeMode,
} from './types.js';
import { ScriptRunner } from './script-runner.js';
import { PortRegistry } from './ports/registry.js';
import { mapRedisError, RedisStoreError, type RedisErrorCode } from './adapters/base.js';
import { withTimeout } from './resilience/timeout.js';
import { Bulkhead } from './resilience/bulkhead.js';
import { CircuitBreaker } from './resilience/circuit-breaker.js';

export function createRedisStore(options: RedisStoreOptions): RedisStore {
  if (!options || typeof options !== 'object') {
    throw new RedisStoreError('RedisStore options must be an object.', {
      code: 'REQNX_INVALID_ARGUMENT',
    });
  }

  const {
    client: clientOption,
    timeMode = 'server',
    clock,
    customPorts,
    timeoutMs = 250,
    maxPending = 0,
    circuitBreaker: circuitBreakerOption,
  } = options;

  if (!clientOption) {
    throw new RedisStoreError('RedisStore options.client is required.', {
      code: 'REQNX_INVALID_ARGUMENT',
    });
  }

  const scriptRunner = new ScriptRunner();
  const registry = new PortRegistry(customPorts);
  const bulkhead = new Bulkhead({ maxPending });

  let circuitBreaker: CircuitBreaker | undefined;
  if (circuitBreakerOption === true) {
    circuitBreaker = new CircuitBreaker();
  } else if (typeof circuitBreakerOption === 'object' && circuitBreakerOption !== null) {
    circuitBreaker = new CircuitBreaker(circuitBreakerOption);
  }

  let closed = false;
  let internallyOwned = false;
  let internalAdapter: RedisClientAdapter | undefined;
  let clientPromise: Promise<RedisClientAdapter> | undefined;

  let timeoutCount = 0;
  let lastErrorCode: string | null = null;
  let lastErrorTimeMs: number | null = null;

  const errorCategories = {
    connection: 0,
    timeout: 0,
    script: 0,
    wrongType: 0,
    corruptState: 0,
    timeRejected: 0,
    overloaded: 0,
    circuitOpen: 0,
    readonly: 0,
    other: 0,
  };

  function recordError(err: unknown): void {
    const code = err instanceof RedisStoreError ? (err.code as string) : '';
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const now = clock ? clock.nowMs() : Date.now();
    lastErrorTimeMs = now;

    if (code === 'timeout' || code === 'REQNX_COMMAND_TIMEOUT' || msg.includes('timed out')) {
      errorCategories.timeout++;
      timeoutCount++;
      lastErrorCode = 'timeout';
    } else if (code === 'overloaded' || code === 'REQNX_OVERLOADED') {
      errorCategories.overloaded++;
      lastErrorCode = 'overloaded';
    } else if (code === 'circuit-open' || code === 'REQNX_CIRCUIT_OPEN') {
      errorCategories.circuitOpen++;
      lastErrorCode = 'circuit-open';
    } else if (code === 'readonly' || code === 'REQNX_READONLY' || msg.includes('readonly')) {
      errorCategories.readonly++;
      lastErrorCode = 'readonly';
    } else if (
      code === 'REQNX_CONNECTION_ERROR' ||
      code === 'connection' ||
      code === 'REQNX_CLIENT_CLOSED' ||
      msg.includes('connection') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('nr_closed') ||
      msg.includes('not connected')
    ) {
      errorCategories.connection++;
      lastErrorCode = 'connection';
    } else if (code === 'REQNX_WRONGTYPE' || msg.includes('wrongtype')) {
      errorCategories.wrongType++;
      lastErrorCode = 'wrongtype';
    } else if (code === 'REQNX_CORRUPT_STATE') {
      errorCategories.corruptState++;
      lastErrorCode = 'corrupt-state';
    } else if (code === 'REQNX_TIME_REJECTED') {
      errorCategories.timeRejected++;
      lastErrorCode = 'time-rejected';
    } else if (code === 'REQNX_SCRIPT_ERROR' || msg.includes('noscript') || msg.includes('eval')) {
      errorCategories.script++;
      lastErrorCode = 'script';
    } else {
      errorCategories.other++;
      lastErrorCode = code || 'other';
    }
  }

  async function executeWithResilience<T>(
    opName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      circuitBreaker?.beforeCall();
    } catch (cbErr) {
      recordError(cbErr);
      throw cbErr;
    }

    try {
      bulkhead.acquire();
    } catch (bhErr) {
      recordError(bhErr);
      throw bhErr;
    }

    try {
      const result = await withTimeout(operation(), {
        timeoutMs,
        opName,
      });
      circuitBreaker?.onSuccess();
      return result;
    } catch (err) {
      const mapped = mapRedisError(err);
      circuitBreaker?.onError(mapped);
      recordError(mapped);
      throw mapped;
    } finally {
      bulkhead.release();
    }
  }

  async function getAdapter(): Promise<RedisClientAdapter> {
    if (closed) {
      throw new RedisStoreError('Cannot perform Redis operation: store has been closed.', {
        code: 'REQNX_CLIENT_CLOSED',
      });
    }

    if (typeof clientOption !== 'string') {
      if (clientOption.isClosed()) {
        throw new RedisStoreError('Cannot perform Redis operation: client is closed.', {
          code: 'REQNX_CLIENT_CLOSED',
        });
      }
      return clientOption;
    }

    if (!clientPromise) {
      clientPromise = (async () => {
        // Attempt node-redis first
        try {
          const { createClient } = await import('redis');
          const client = createClient({ url: clientOption });
          await client.connect();
          const { createNodeRedisAdapter } = await import('./adapters/node-redis.js');
          internallyOwned = true;
          internalAdapter = createNodeRedisAdapter(
            client as unknown as Parameters<typeof createNodeRedisAdapter>[0],
          );
          return internalAdapter;
        } catch {
          // Fall back to ioredis
          try {
            const { default: Redis } = await import('ioredis');
            const client = new (
              Redis as unknown as { new (url: string): Parameters<typeof createIORedisAdapter>[0] }
            )(clientOption);
            const { createIORedisAdapter } = await import('./adapters/ioredis.js');
            internallyOwned = true;
            internalAdapter = createIORedisAdapter(client);
            return internalAdapter;
          } catch {
            throw new RedisStoreError(
              'Neither "redis" nor "ioredis" peer dependency is available to connect to Redis URL. Install one or pass a RedisClientAdapter instance directly.',
              { code: 'REQNX_MISSING_PEER_DEPENDENCY' },
            );
          }
        }
      })();
    }

    const adapter = await clientPromise;
    if (adapter.isClosed()) {
      throw new RedisStoreError('Cannot perform Redis operation: client is closed.', {
        code: 'REQNX_CLIENT_CLOSED',
      });
    }
    return adapter;
  }

  async function resolveNowMs(
    mode: RedisTimeMode,
    explicitClock?: Clock,
    adapter?: RedisClientAdapter,
  ): Promise<number> {
    if (explicitClock) {
      return explicitClock.nowMs();
    }
    if (mode === 'pre-call') {
      if (!adapter?.time) {
        throw new RedisStoreError(
          'Client adapter does not support time() command required for pre-call time mode.',
          { code: 'REQNX_UNSUPPORTED_OPERATION' },
        );
      }
      const [sec, usec] = await adapter.time();
      return Math.floor(sec * 1000 + usec / 1000);
    }
    // Server time mode: 0 signals script to call redis.call('TIME')
    return 0;
  }

  const store: RedisStore = {
    id: 'redis',

    async consume<C, S>(
      algorithm: Algorithm<C, S>,
      key: string,
      config: C,
      cost: number,
    ): Promise<Decision> {
      if (typeof cost !== 'number' || !Number.isSafeInteger(cost) || cost < 1) {
        throw new RedisStoreError(`Consumption cost must be a safe integer >= 1, got ${cost}.`, {
          code: 'REQNX_INVALID_ARGUMENT',
        });
      }

      return await executeWithResilience('consume', async () => {
        const adapter = await getAdapter();
        const port = registry.get(algorithm.id);
        const nowMs = await resolveNowMs(timeMode, clock, adapter);
        const args = [...port.buildConsumeArgs(config, cost, nowMs), algorithm.stateVersion ?? 1];

        const rawReply = await scriptRunner.runScript(
          adapter,
          port.consumeSha,
          port.consumeScript,
          [key],
          args,
        );

        return port.parseReply(rawReply);
      });
    },

    async peek<C, S>(algorithm: Algorithm<C, S>, key: string, config: C): Promise<Decision> {
      return await executeWithResilience('peek', async () => {
        const adapter = await getAdapter();
        const port = registry.get(algorithm.id);
        const nowMs = await resolveNowMs(timeMode, clock, adapter);
        const args = [...port.buildPeekArgs(config, nowMs), algorithm.stateVersion ?? 1];

        const rawReply = await scriptRunner.runReadOnlyScript(
          adapter,
          port.peekSha,
          port.peekScript,
          [key],
          args,
        );

        return port.parseReply(rawReply);
      });
    },

    async reset(key: string): Promise<void> {
      await executeWithResilience('reset', async () => {
        const adapter = await getAdapter();
        await adapter.unlink(key);
      });
    },

    async warmup(): Promise<void> {
      await executeWithResilience('warmup', async () => {
        const adapter = await getAdapter();
        const ports = registry.getAll();
        for (const port of ports) {
          await scriptRunner.preload(adapter, port.consumeScript);
          await scriptRunner.preload(adapter, port.peekScript);
        }
      });
    },

    async ping(): Promise<{ ok: boolean; latencyMs: number; code?: RedisErrorCode }> {
      const start = Date.now();
      try {
        const adapter = await getAdapter();
        await withTimeout(
          adapter.ping ? adapter.ping() : adapter.eval('return 1', [], []),
          { timeoutMs, opName: 'Redis ping' },
        );
        return {
          ok: true,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        const mapped = mapRedisError(err);
        return {
          ok: false,
          latencyMs: Date.now() - start,
          code: (mapped.code as RedisErrorCode) || 'connection',
        };
      }
    },

    stats(): RedisStoreStats {
      const runnerStats = scriptRunner.getStats();
      return {
        evalshaCalls: runnerStats.evalshaCalls,
        evalFallbacks: runnerStats.evalFallbacks,
        timeouts: timeoutCount,
        inFlight: bulkhead.currentInFlight,
        pendingPeak: bulkhead.peakInFlight,
        circuitState: circuitBreaker ? circuitBreaker.state : null,
        lastErrorCode,
        lastErrorTimeMs,
        errors: {
          connection: errorCategories.connection,
          timeout: errorCategories.timeout,
          script: errorCategories.script,
          wrongType: errorCategories.wrongType,
          corruptState: errorCategories.corruptState,
          timeRejected: errorCategories.timeRejected,
          overloaded: errorCategories.overloaded,
          circuitOpen: errorCategories.circuitOpen,
          readonly: errorCategories.readonly,
          other: errorCategories.other,
        },
      };
    },

    registerPort<C = unknown, S = unknown>(port: AlgorithmRedisPort<C, S>): void {
      registry.register(port);
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (internallyOwned && internalAdapter) {
        await internalAdapter.close();
      }
    },
  };

  return store;
}
