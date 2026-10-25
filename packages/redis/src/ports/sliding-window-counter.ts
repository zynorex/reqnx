// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Algorithm Port: slidingWindowCounter
//
// Bridges @reqnx/core slidingWindowCounter configuration and decisions with Redis Lua scripts.
// ──────────────────────────────────────────────────────────────────────────────

import { type Decision, type SlidingWindowCounterConfig } from '@reqnx/core';
import { type AlgorithmRedisPort } from '../types.js';
import {
  SLIDING_WINDOW_COUNTER_CONSUME_SCRIPT,
  SLIDING_WINDOW_COUNTER_CONSUME_SHA,
  SLIDING_WINDOW_COUNTER_PEEK_SCRIPT,
  SLIDING_WINDOW_COUNTER_PEEK_SHA,
} from '../scripts/generated.js';
import { normaliseSafeInt, RedisStoreError } from '../adapters/base.js';

export const slidingWindowCounterRedisPort: AlgorithmRedisPort<SlidingWindowCounterConfig> = {
  algorithmId: 'sliding-window-counter',
  consumeScript: SLIDING_WINDOW_COUNTER_CONSUME_SCRIPT,
  consumeSha: SLIDING_WINDOW_COUNTER_CONSUME_SHA,
  peekScript: SLIDING_WINDOW_COUNTER_PEEK_SCRIPT,
  peekSha: SLIDING_WINDOW_COUNTER_PEEK_SHA,

  buildConsumeArgs(
    config: SlidingWindowCounterConfig,
    cost: number,
    nowMsOverride?: number,
  ): (string | number)[] {
    return [config.limit, config.windowMs, cost, nowMsOverride ?? 0];
  },

  buildPeekArgs(config: SlidingWindowCounterConfig, nowMsOverride?: number): (string | number)[] {
    return [config.limit, config.windowMs, 0, nowMsOverride ?? 0];
  },

  parseReply(reply: unknown): Decision {
    if (!Array.isArray(reply) || reply.length < 5) {
      throw new RedisStoreError(
        `Invalid reply structure from sliding-window-counter Redis script: expected 5-element array, received ${JSON.stringify(reply)}.`,
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
