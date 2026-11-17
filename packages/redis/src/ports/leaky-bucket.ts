// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Algorithm Port: leakyBucket
//
// Bridges @reqnx/core leakyBucket configuration and decisions with Redis Lua scripts.
// Reuses the exact Token Bucket Lua scripts without copying Lua code, mapping
// LeakyBucketConfig parameters to the underlying state machine.
// ──────────────────────────────────────────────────────────────────────────────

import { type Decision, type LeakyBucketConfig } from '@reqnx/core';
import { type AlgorithmRedisPort } from '../types.js';
import {
  TOKEN_BUCKET_CONSUME_SCRIPT,
  TOKEN_BUCKET_CONSUME_SHA,
  TOKEN_BUCKET_PEEK_SCRIPT,
  TOKEN_BUCKET_PEEK_SHA,
} from '../scripts/generated.js';
import { normaliseSafeInt, RedisStoreError } from '../adapters/base.js';

export const leakyBucketRedisPort: AlgorithmRedisPort<LeakyBucketConfig> = {
  algorithmId: 'leaky-bucket',
  consumeScript: TOKEN_BUCKET_CONSUME_SCRIPT,
  consumeSha: TOKEN_BUCKET_CONSUME_SHA,
  peekScript: TOKEN_BUCKET_PEEK_SCRIPT,
  peekSha: TOKEN_BUCKET_PEEK_SHA,

  buildConsumeArgs(
    config: LeakyBucketConfig,
    cost: number,
    nowMsOverride?: number,
  ): (string | number)[] {
    return [
      config.capacity,
      config.a,
      config.b,
      config.capacityUnits,
      config.drainTimeMs,
      cost,
      nowMsOverride ?? 0,
    ];
  },

  buildPeekArgs(config: LeakyBucketConfig, nowMsOverride?: number): (string | number)[] {
    return [
      config.capacity,
      config.a,
      config.b,
      config.capacityUnits,
      config.drainTimeMs,
      0,
      nowMsOverride ?? 0,
    ];
  },

  parseReply(reply: unknown): Decision {
    if (!Array.isArray(reply) || reply.length < 5) {
      throw new RedisStoreError(
        `Invalid reply structure from leaky-bucket Redis script: expected 5-element array, received ${JSON.stringify(reply)}.`,
        { code: 'REQNX_CORRUPT_STATE' },
      );
    }

    const allowedNum = normaliseSafeInt(reply[0], 'allowed');
    const limit = normaliseSafeInt(reply[1], 'limit');
    const remaining = normaliseSafeInt(reply[2], 'remaining');
    const resetAtMs = normaliseSafeInt(reply[3], 'resetAtMs');
    const retryAfterMs = normaliseSafeInt(reply[4], 'retryAfterMs');

    return {
      allowed: allowedNum === 1,
      limit,
      remaining,
      resetAtMs,
      retryAfterMs,
      degraded: false,
    };
  },
};
