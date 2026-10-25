// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Algorithm Port: fixedWindow
//
// Bridges @reqnx/core fixedWindow configuration and decisions with Redis Lua scripts.
// ──────────────────────────────────────────────────────────────────────────────

import { type Decision, type FixedWindowConfig } from '@reqnx/core';
import { type AlgorithmRedisPort } from '../types.js';
import {
  FIXED_WINDOW_CONSUME_SCRIPT,
  FIXED_WINDOW_CONSUME_SHA,
  FIXED_WINDOW_PEEK_SCRIPT,
  FIXED_WINDOW_PEEK_SHA,
} from '../scripts/generated.js';
import { normaliseSafeInt, RedisStoreError } from '../adapters/base.js';

export const fixedWindowRedisPort: AlgorithmRedisPort<FixedWindowConfig> = {
  algorithmId: 'fixed-window',
  consumeScript: FIXED_WINDOW_CONSUME_SCRIPT,
  consumeSha: FIXED_WINDOW_CONSUME_SHA,
  peekScript: FIXED_WINDOW_PEEK_SCRIPT,
  peekSha: FIXED_WINDOW_PEEK_SHA,

  buildConsumeArgs(config: FixedWindowConfig, cost: number, nowMsOverride?: number): (string | number)[] {
    return [config.limit, config.windowMs, cost, nowMsOverride ?? 0];
  },

  buildPeekArgs(config: FixedWindowConfig, nowMsOverride?: number): (string | number)[] {
    return [config.limit, config.windowMs, 0, nowMsOverride ?? 0];
  },

  parseReply(reply: unknown): Decision {
    if (!Array.isArray(reply) || reply.length < 5) {
      throw new RedisStoreError(
        `Invalid reply structure from fixed-window Redis script: expected 5-element array, received ${JSON.stringify(reply)}.`,
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
