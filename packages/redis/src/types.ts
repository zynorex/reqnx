// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Core Types & Structural Interfaces
//
// Defines the client adapter interface, configuration options, and stats types.
// ──────────────────────────────────────────────────────────────────────────────

import { type AlgorithmId, type Clock, type Decision, type Store } from '@reqnx/core';

/**
 * Minimal structural client adapter interface.
 *
 * Decouples `@reqnx/redis` from any specific Redis client package.
 * Both `node-redis` and `ioredis` adapters implement this interface.
 */
export interface RedisClientAdapter {
  /** Identifier of the underlying client adapter. */
  readonly name: 'node-redis' | 'ioredis' | 'custom';

  /**
   * Execute a Lua script by its SHA1 hash.
   *
   * @param sha - 40-character hex SHA1 hash of the script.
   * @param keys - Array of Redis storage keys.
   * @param args - Array of string or numeric arguments.
   * @returns Raw Redis reply.
   */
  evalSha(sha: string, keys: string[], args: (string | number)[]): Promise<unknown>;

  /**
   * Execute a raw Lua script string directly.
   *
   * Used as automatic fallback on NOSCRIPT errors.
   *
   * @param script - Full Lua script body.
   * @param keys - Array of Redis storage keys.
   * @param args - Array of string or numeric arguments.
   * @returns Raw Redis reply.
   */
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;

  /**
   * Execute a read-only Lua script by SHA1, if supported by the client.
   *
   * Routes to read-only replicas in Redis Cluster configurations when available.
   */
  evalShaReadOnly?(sha: string, keys: string[], args: (string | number)[]): Promise<unknown>;

  /**
   * Execute a read-only raw Lua script, if supported by the client.
   */
  evalReadOnly?(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;

  /**
   * Delete one or more keys asynchronously via UNLINK.
   */
  unlink(key: string): Promise<number>;

  /**
   * Return the remaining time to live of a key in milliseconds.
   */
  pttl?(key: string): Promise<number>;

  /**
   * Load a Lua script into the Redis script cache without executing it.
   */
  scriptLoad?(script: string): Promise<string>;

  /**
   * Read the server time as `[seconds, microseconds]`.
   *
   * Used by `timeMode: 'pre-call'` for restrictive proxy environments.
   */
  time?(): Promise<[seconds: number, microseconds: number]>;

  /**
   * Check whether the underlying client connection has been closed.
   */
  isClosed(): boolean;

  /**
   * Check whether the underlying client is currently connected and ready.
   */
  isConnected?(): boolean;

  /**
   * Close the underlying client connection.
   */
  close(): Promise<void>;
}

/**
 * Time resolution mode for Redis Lua script execution.
 *
 * - `'server'`: (Default) Scripts read time directly on the Redis server via `redis.call('TIME')`.
 *   Eliminates clock skew between application nodes.
 * - `'pre-call'`: Fetches server time via a separate `TIME` round-trip command prior to script
 *   execution, passing the timestamp into the script via ARGV. Required for managed proxies
 *   (e.g., AWS ElastiCache Serverless) that disallow `TIME` inside Lua scripts.
 */
export type RedisTimeMode = 'server' | 'pre-call';

/**
 * Configuration options for {@link createRedisStore}.
 */
export interface RedisStoreOptions {
  /**
   * A structural client adapter instance (from `@reqnx/redis/node-redis` or `@reqnx/redis/ioredis`),
   * or a connection URL string (`redis://...` or `rediss://...`).
   *
   * - When an adapter instance is passed, connection lifecycle is owned by the caller (the store
   *   will never close it).
   * - When a connection URL is passed, the store creates and owns an internal client, closing it
   *   when `store.close()` is called.
   */
  readonly client: RedisClientAdapter | string;

  /**
   * Key namespace prefix.
   *
   * Non-empty ASCII string without colons.
   *
   * @default 'rl'
   */
  readonly prefix?: string;

  /**
   * Time resolution mode.
   *
   * @default 'server'
   */
  readonly timeMode?: RedisTimeMode;

  /**
   * Optional custom clock for explicit time injection.
   *
   * When provided, `clock.now()` is passed as an explicit `nowMs` argument to all Lua scripts,
   * overriding server time. Used for deterministic testing with `FakeClock`.
   */
  readonly clock?: Clock;

  /**
   * Custom algorithm Redis port definitions to register on this store instance.
   */
  readonly customPorts?: readonly AlgorithmRedisPort<unknown, unknown>[];
}

/**
 * Execution metrics and counter statistics exposed by {@link RedisStore.stats}.
 */
export interface RedisStoreStats {
  /** Number of successful `EVALSHA` executions without fallback. */
  readonly evalshaCalls: number;
  /** Number of `NOSCRIPT` occurrences that triggered fallback to `EVAL`. */
  readonly evalFallbacks: number;
  /** Count of errors grouped by error classification. */
  readonly errors: {
    readonly connection: number;
    readonly timeout: number;
    readonly script: number;
    readonly wrongType: number;
    readonly corruptState: number;
    readonly timeRejected: number;
    readonly other: number;
  };
}

/**
 * Definition of a Redis Lua port for a specific rate-limiting algorithm.
 */
export interface AlgorithmRedisPort<Config = unknown, _State = unknown> {
  /** Target algorithm ID matching `Algorithm.id`. */
  readonly algorithmId: AlgorithmId;

  /**
   * Full Lua script body for the consume operation.
   */
  readonly consumeScript: string;

  /**
   * Full Lua script body for the read-only peek operation (`#!lua flags=no-writes`).
   */
  readonly peekScript: string;

  /** Precomputed 40-character hex SHA1 hash of {@link consumeScript}. */
  readonly consumeSha: string;

  /** Precomputed 40-character hex SHA1 hash of {@link peekScript}. */
  readonly peekSha: string;

  /**
   * Build the array of ARGV strings/numbers for the consume Lua script from parsed config.
   *
   * @param config - Validated, parsed algorithm configuration.
   * @param cost - Requested consumption cost.
   * @param nowMsOverride - Explicit millisecond timestamp if provided (> 0).
   */
  buildConsumeArgs(config: Config, cost: number, nowMsOverride?: number): (string | number)[];

  /**
   * Build the array of ARGV strings/numbers for the peek Lua script from parsed config.
   *
   * @param config - Validated, parsed algorithm configuration.
   * @param nowMsOverride - Explicit millisecond timestamp if provided (> 0).
   */
  buildPeekArgs(config: Config, nowMsOverride?: number): (string | number)[];

  /**
   * Parse the raw array reply from the Lua script into a strictly validated {@link Decision}.
   *
   * @param reply - Raw reply array from Redis `[allowed, limit, remaining, resetAtMs, retryAfterMs]`.
   */
  parseReply(reply: unknown): Decision;
}

/**
 * Extended {@link Store} interface returned by {@link createRedisStore}.
 */
export interface RedisStore extends Store {
  /**
   * Pre-load all registered algorithm Lua scripts into Redis using `SCRIPT LOAD`.
   *
   * Recommended to call after connecting or reconnecting to eliminate first-call `EVAL` latency.
   */
  warmup(): Promise<void>;

  /**
   * Return execution counters and statistics.
   */
  stats(): RedisStoreStats;

  /**
   * Register a custom Lua port definition for an algorithm ID.
   */
  registerPort<C = unknown, S = unknown>(port: AlgorithmRedisPort<C, S>): void;
}
