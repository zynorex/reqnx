// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — RedisStore Implementation
//
// Atomic rate limiter store executing algorithm Lua scripts on Redis.
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
import { RedisStoreError } from './adapters/base.js';

export function createRedisStore(options: RedisStoreOptions): RedisStore {
  if (!options || typeof options !== 'object') {
    throw new RedisStoreError('RedisStore options must be an object.', {
      code: 'REQNX_INVALID_ARGUMENT',
    });
  }

  const { client: clientOption, timeMode = 'server', clock, customPorts } = options;

  if (!clientOption) {
    throw new RedisStoreError('RedisStore options.client is required.', {
      code: 'REQNX_INVALID_ARGUMENT',
    });
  }

  const scriptRunner = new ScriptRunner();
  const registry = new PortRegistry(customPorts);

  let closed = false;
  let internallyOwned = false;
  let internalAdapter: RedisClientAdapter | undefined;
  let clientPromise: Promise<RedisClientAdapter> | undefined;

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
          internalAdapter = createNodeRedisAdapter(client as any);
          return internalAdapter;
        } catch {
          // Fall back to ioredis
          try {
            const { default: Redis } = await import('ioredis');
            const client = new (Redis as any)(clientOption);
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

      const adapter = await getAdapter();
      const port = registry.get(algorithm.id);
      const nowMs = await resolveNowMs(timeMode, clock, adapter);
      const args = port.buildConsumeArgs(config, cost, nowMs);

      const rawReply = await scriptRunner.runScript(
        adapter,
        port.consumeSha,
        port.consumeScript,
        [key],
        args,
      );

      return port.parseReply(rawReply);
    },

    async peek<C, S>(algorithm: Algorithm<C, S>, key: string, config: C): Promise<Decision> {
      const adapter = await getAdapter();
      const port = registry.get(algorithm.id);
      const nowMs = await resolveNowMs(timeMode, clock, adapter);
      const args = port.buildPeekArgs(config, nowMs);

      const rawReply = await scriptRunner.runReadOnlyScript(
        adapter,
        port.peekSha,
        port.peekScript,
        [key],
        args,
      );

      return port.parseReply(rawReply);
    },

    async reset(key: string): Promise<void> {
      const adapter = await getAdapter();
      await adapter.unlink(key);
    },

    async warmup(): Promise<void> {
      const adapter = await getAdapter();
      const ports = registry.getAll();
      for (const port of ports) {
        await scriptRunner.preload(adapter, port.consumeScript);
        await scriptRunner.preload(adapter, port.peekScript);
      }
    },

    stats(): RedisStoreStats {
      return scriptRunner.getStats();
    },

    registerPort(port: AlgorithmRedisPort<any, any>): void {
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
