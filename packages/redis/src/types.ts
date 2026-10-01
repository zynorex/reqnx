// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Redis-specific types
//
// Types for RedisStore configuration. Implementation on Day 6.
// ──────────────────────────────────────────────────────────────────────────────

import { type AlgorithmId } from '@reqnx/core';

/**
 * Configuration options for {@link RedisStore}.
 */
export interface RedisStoreOptions {
  /**
   * An ioredis client instance. The store does NOT manage the connection
   * lifecycle — the caller is responsible for connecting and disconnecting.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any; // ioredis.Redis — typed as any to avoid importing ioredis at the type level

  /**
   * Optional: override the Lua script registry. By default, RedisStore
   * ships with scripts for all five algorithms. Use this to add custom
   * algorithm implementations.
   */
  scripts?: Partial<Record<AlgorithmId, string>>;
}
