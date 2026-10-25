// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — ioredis Adapter
//
// Adapter wrapping ioredis (Redis / Cluster / Sentinel).
// ──────────────────────────────────────────────────────────────────────────────

import { type RedisClientAdapter } from '../types.js';
import { mapRedisError, normaliseArgs } from './base.js';

/**
 * Minimal type interface for the ioredis client methods used by REQNX.
 */
export interface IORedisClientLike {
  status: string;
  evalsha(sha: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  unlink(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  script(subcommand: string, ...args: string[]): Promise<unknown>;
  time(): Promise<[string, string] | [number, number]>;
  quit(): Promise<unknown>;
  disconnect?(): void;
}

/**
 * Wrap an existing `ioredis` client instance in the {@link RedisClientAdapter} interface.
 *
 * @param client - An instance created with `new Redis(...)` from `'ioredis'`.
 * @example
 * ```ts
 * import Redis from 'ioredis';
 * import { createIORedisAdapter } from '@reqnx/redis/ioredis';
 * import { createRedisStore } from '@reqnx/redis';
 *
 * const client = new Redis('redis://localhost:6379');
 *
 * const store = createRedisStore({
 *   client: createIORedisAdapter(client),
 * });
 * ```
 */
export function createIORedisAdapter(client: IORedisClientLike): RedisClientAdapter {
  return {
    name: 'ioredis',

    async evalSha(sha: string, keys: string[], args: (string | number)[]): Promise<unknown> {
      try {
        const cleanArgs = normaliseArgs(args);
        return await client.evalsha(sha, keys.length, ...keys, ...cleanArgs);
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
      try {
        const cleanArgs = normaliseArgs(args);
        return await client.eval(script, keys.length, ...keys, ...cleanArgs);
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
        return await client.pttl(key);
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async scriptLoad(script: string): Promise<string> {
      try {
        const res = await client.script('LOAD', script);
        return String(res);
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    async time(): Promise<[seconds: number, microseconds: number]> {
      try {
        const res = await client.time();
        const sec = Number(res[0]);
        const usec = Number(res[1]);
        return [sec, usec];
      } catch (err) {
        throw mapRedisError(err);
      }
    },

    isClosed(): boolean {
      return client.status === 'end' || client.status === 'close';
    },

    isConnected(): boolean {
      return client.status === 'ready' || client.status === 'connect';
    },

    async close(): Promise<void> {
      try {
        await client.quit();
      } catch {
        if (typeof client.disconnect === 'function') {
          client.disconnect();
        }
      }
    },
  };
}
