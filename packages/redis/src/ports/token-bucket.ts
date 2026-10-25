// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Algorithm Port: tokenBucket
//
// Bridges @reqnx/core tokenBucket configuration and decisions with Redis Lua scripts.
// ──────────────────────────────────────────────────────────────────────────────

import { type Decision, type TokenBucketConfig } from '@reqnx/core';
import { type AlgorithmRedisPort } from '../types.js';
import {
  TOKEN_BUCKET_CONSUME_SCRIPT,
  TOKEN_BUCKET_CONSUME_SHA,
  TOKEN_BUCKET_PEEK_SCRIPT,
  TOKEN_BUCKET_PEEK_SHA,
} from '../scripts/generated.js';
import { normaliseSafeInt, RedisStoreError } from '../adapters/base.js';

export const tokenBucketRedisPort: AlgorithmRedisPort<TokenBucketConfig> = {
  algorithmId: 'token-bucket',
  consumeScript: TOKEN_BUCKET_CONSUME_SCRIPT,
  consumeSha: TOKEN_BUCKET_CONSUME_SHA,
  peekScript: TOKEN_BUCKET_PEEK_SCRIPT,
  peekSha: TOKEN_BUCKET_PEEK_SHA,

  buildConsumeArgs(
    config: TokenBucketConfig,
    cost: number,
    nowMsOverride?: number,
  ): (string | number)[] {
    return [
      config.capacity,
      config.a,
      config.b,
      config.capacityUnits,
      config.fullRefillMs,
      cost,
      nowMsOverride ?? 0,
    ];
  },

  buildPeekArgs(config: TokenBucketConfig, nowMsOverride?: number): (string | number)[] {
    return [
      config.capacity,
      config.a,
      config.b,
      config.capacityUnits,
      config.fullRefillMs,
      0,
      nowMsOverride ?? 0,
    ];
  },

  parseReply(reply: unknown): Decision {
    if (!Array.isArray(reply) || reply.length < 5) {
      throw new RedisStoreError(
        `Invalid reply structure from token-bucket Redis script: expected 5-element array, received ${JSON.stringify(reply)}.`,
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
