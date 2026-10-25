// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — node-redis Adapter
//
// Adapter wrapping node-redis (RedisClientType / createClient).
// ──────────────────────────────────────────────────────────────────────────────

import { type RedisClientAdapter } from '../types.js';
import { mapRedisError, normaliseArgs, RedisStoreError } from './base.js';

/**
 * Minimal type interface for the node-redis client methods used by REQNX.
 */
export interface NodeRedisClientLike {
  isOpen: boolean;
  isReady: boolean;
  evalSha(sha: string, options?: { keys?: string[]; arguments?: string[] }): Promise<unknown>;
  eval(script: string, options?: { keys?: string[]; arguments?: string[] }): Promise<unknown>;
  unlink(keys: string | string[]): Promise<number>;
  pTTL(key: string): Promise<number>;
  scriptLoad?(script: string): Promise<string>;
  time?(): Promise<unknown>;
  quit(): Promise<unknown>;
  disconnect?(): Promise<unknown>;
}

/**
 * Wrap an existing `node-redis` client instance in the {@link RedisClientAdapter} interface.
 *
 * @param client - An instance created with `createClient()` from `'redis'`.
 * @example
 * ```ts
 * import { createClient } from 'redis';
 * import { createNodeRedisAdapter } from '@reqnx/redis/node-redis';
 * import { createRedisStore } from '@reqnx/redis';
 *
 * const client = createClient({ url: 'redis://localhost:6379' });
 * await client.connect();
 *
 * const store = createRedisStore({
 *   client: createNodeRedisAdapter(client),
 * });
 * ```
 */
export function createNodeRedisAdapter(client: NodeRedisClientLike): RedisClientAdapter {
  return {
    name: 'node-redis',

    async evalSha(sha: string, keys: string[], args: (string | number)[]): Promise<unknown> {
      try {
        const cleanArgs = normaliseArgs(args);
        return await client.evalSha(sha, { keys, arguments: cleanArgs });
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
      try {
        const cleanArgs = normaliseArgs(args);
        return await client.eval(script, { keys, arguments: cleanArgs });
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async unlink(key: string): Promise<number> {
      try {
        return await client.unlink(key);
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async pttl(key: string): Promise<number> {
      try {
        return await client.pTTL(key);
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async scriptLoad(script: string): Promise<string> {
      if (typeof client.scriptLoad !== 'function') {
        throw new RedisStoreError('Client does not support scriptLoad command.', {
          code: 'REQNX_UNSUPPORTED_OPERATION',
        });
      }
      try {
        return await client.scriptLoad(script);
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async time(): Promise<[seconds: number, microseconds: number]> {
      if (typeof client.time !== 'function') {
        throw new RedisStoreError('Client does not support time command.', {
          code: 'REQNX_UNSUPPORTED_OPERATION',
        });
      }
      try {
        const res = await client.time();
        if (Array.isArray(res)) {
          const sec = Number(res[0]);
          const usec = Number(res[1]);
          return [sec, usec];
        }
        if (res instanceof Date) {
          const ms = res.getTime();
          return [Math.floor(ms / 1000), (ms % 1000) * 1000];
        }
        throw new RedisStoreError('Unexpected TIME reply shape from Redis client.', {
          code: 'REQNX_CORRUPT_STATE',
        });
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    isClosed(): boolean {
      return !client.isOpen;
    },

    isConnected(): boolean {
      return client.isReady;
    },

    async close(): Promise<void> {
      try {
        await client.quit();
      } catch {
        if (client.disconnect) {
          await client.disconnect();
        }
      }
    },
  };
}
