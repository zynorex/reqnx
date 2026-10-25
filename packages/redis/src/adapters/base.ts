// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Adapter Base Helpers
//
// Shared argument/reply normalisation, safe integer bounds validation,
// and StoreError classification.
// ──────────────────────────────────────────────────────────────────────────────

import { StoreError } from '@reqnx/core';

/** Maximum safe integer for IEEE 754 64-bit float / Lua double precision. */
export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER; // 9007199254740991 (2^53 - 1)
export const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

export type RedisErrorCode =
  | 'REQNX_CONNECTION_ERROR'
  | 'REQNX_COMMAND_TIMEOUT'
  | 'REQNX_WRONGTYPE'
  | 'REQNX_TIME_REJECTED'
  | 'REQNX_CORRUPT_STATE'
  | 'REQNX_INVALID_ARGUMENT'
  | 'REQNX_READONLY'
  | 'REQNX_SCRIPT_ERROR'
  | 'REQNX_CLIENT_CLOSED'
  | 'REQNX_UNSUPPORTED_OPERATION'
  | 'REQNX_UNSUPPORTED_ALGORITHM'
  | 'REQNX_MISSING_PEER_DEPENDENCY';

/**
 * Specialized StoreError subclass carrying structured machine-readable error codes.
 */
export class RedisStoreError extends StoreError {
  override readonly code: RedisErrorCode;

  constructor(message: string, options?: { code?: RedisErrorCode; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'RedisStoreError';
    this.code = options?.code ?? 'REQNX_SCRIPT_ERROR';
  }
}

/**
 * Format and validate arguments passed to Redis EVAL/EVALSHA.
 *
 * Enforces that all numeric arguments are safe integers.
 */
export function normaliseArgs(args: (string | number)[]): string[] {
  const result: string[] = new Array(args.length);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === 'number') {
      if (!Number.isFinite(arg) || !Number.isInteger(arg)) {
        throw new RedisStoreError(
          `Redis script argument at index ${i} must be a finite safe integer, got ${arg}.`,
          { code: 'REQNX_INVALID_ARGUMENT' },
        );
      }
      if (arg > MAX_SAFE_INTEGER || arg < MIN_SAFE_INTEGER) {
        throw new RedisStoreError(
          `Redis script argument at index ${i} (${arg}) exceeds safe integer range [-2^53 + 1, 2^53 - 1].`,
          { code: 'REQNX_INVALID_ARGUMENT' },
        );
      }
      result[i] = String(arg);
    } else if (typeof arg === 'string') {
      result[i] = arg;
    } else {
      throw new RedisStoreError(
        `Redis script argument at index ${i} must be a string or number, got ${typeof arg}.`,
        { code: 'REQNX_INVALID_ARGUMENT' },
      );
    }
  }
  return result;
}

/**
 * Normalise a numeric return value from Redis (number, string, or bigint) to a safe JavaScript integer.
 */
export function normaliseSafeInt(val: unknown, fieldName: string): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || !Number.isInteger(val)) {
      throw new RedisStoreError(
        `Expected safe integer for ${fieldName}, received non-integer number ${val}.`,
        { code: 'REQNX_CORRUPT_STATE' },
      );
    }
    if (val > MAX_SAFE_INTEGER || val < MIN_SAFE_INTEGER) {
      throw new RedisStoreError(
        `Value for ${fieldName} (${val}) exceeds safe integer range [-2^53 + 1, 2^53 - 1].`,
        { code: 'REQNX_CORRUPT_STATE' },
      );
    }
    return val;
  }

  if (typeof val === 'string') {
    const num = Number(val);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      throw new RedisStoreError(
        `Expected integer string for ${fieldName}, received ${JSON.stringify(val)}.`,
        { code: 'REQNX_CORRUPT_STATE' },
      );
    }
    if (num > MAX_SAFE_INTEGER || num < MIN_SAFE_INTEGER) {
      throw new RedisStoreError(
        `Integer string for ${fieldName} (${val}) exceeds safe integer range.`,
        { code: 'REQNX_CORRUPT_STATE' },
      );
    }
    return num;
  }

  if (typeof val === 'bigint') {
    if (val > BigInt(MAX_SAFE_INTEGER) || val < BigInt(MIN_SAFE_INTEGER)) {
      throw new RedisStoreError(
        `BigInt for ${fieldName} (${val.toString()}) exceeds safe integer range.`,
        { code: 'REQNX_CORRUPT_STATE' },
      );
    }
    return Number(val);
  }

  throw new RedisStoreError(
    `Expected integer value for ${fieldName}, received ${typeof val} (${String(val)}).`,
    { code: 'REQNX_CORRUPT_STATE' },
  );
}

/**
 * Determine whether a caught error is a Redis NOSCRIPT error.
 */
export function isNoScriptError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('NOSCRIPT') || msg.startsWith('NOSCRIPT');
}

/**
 * Map raw client and script errors to structured {@link RedisStoreError} instances with stable codes.
 */
export function mapRedisError(err: unknown): RedisStoreError {
  if (err instanceof RedisStoreError) {
    return err;
  }

  const rawMsg = err instanceof Error ? err.message : String(err);
  const lowerMsg = rawMsg.toLowerCase();

  // 1. Connection / Network errors
  if (
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('connection is closed') ||
    lowerMsg.includes('client is closed') ||
    lowerMsg.includes('not connected') ||
    lowerMsg.includes('nr_closed') ||
    lowerMsg.includes('enotfound')
  ) {
    return new RedisStoreError(`Redis connection error: ${rawMsg}`, {
      code: 'REQNX_CONNECTION_ERROR',
      cause: err,
    });
  }

  // 2. Command Timeout
  if (lowerMsg.includes('timed out') || lowerMsg.includes('timeout')) {
    return new RedisStoreError(`Redis command timeout: ${rawMsg}`, {
      code: 'REQNX_COMMAND_TIMEOUT',
      cause: err,
    });
  }

  // 3. WRONGTYPE Operation against a key holding the wrong kind of value
  if (rawMsg.includes('WRONGTYPE')) {
    return new RedisStoreError(
      `Redis WRONGTYPE error: Target key holds a data type incompatible with rate limiter state. ${rawMsg}`,
      { code: 'REQNX_WRONGTYPE', cause: err },
    );
  }

  // 4. Server rejected TIME inside Lua script
  if (
    rawMsg.includes('REQNX_TIME_REJECTED') ||
    (rawMsg.includes('TIME') && (lowerMsg.includes('not allowed') || lowerMsg.includes('rejected')))
  ) {
    return new RedisStoreError(
      `Redis server rejected TIME inside Lua script: ${rawMsg}. Configure timeMode: 'pre-call' or provide an explicit synchronized Clock.`,
      { code: 'REQNX_TIME_REJECTED', cause: err },
    );
  }

  // 5. Corrupt state error from Lua validation
  if (rawMsg.includes('REQNX_CORRUPT_STATE')) {
    return new RedisStoreError(`Redis state corrupted: ${rawMsg}`, {
      code: 'REQNX_CORRUPT_STATE',
      cause: err,
    });
  }

  // 6. Invalid argument from Lua validation
  if (rawMsg.includes('REQNX_INVALID_ARGUMENT')) {
    return new RedisStoreError(`Redis invalid argument: ${rawMsg}`, {
      code: 'REQNX_INVALID_ARGUMENT',
      cause: err,
    });
  }

  // 7. READONLY error (e.g. replica during write)
  if (rawMsg.includes('READONLY')) {
    return new RedisStoreError(
      `Redis READONLY error: Cannot write to a read-only replica. ${rawMsg}`,
      {
        code: 'REQNX_READONLY',
        cause: err,
      },
    );
  }

  // Default: generic script or store error
  return new RedisStoreError(`Redis store operation failed: ${rawMsg}`, {
    code: 'REQNX_SCRIPT_ERROR',
    cause: err,
  });
}
