// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Timeout Wrapper
//
// Enforces a strict per-call deadline on Redis commands, clears timers
// deterministically on every path, and suppresses unhandled rejections on
// abandoned client promises.
// ──────────────────────────────────────────────────────────────────────────────

import { RedisStoreError } from '../adapters/base.js';

export interface TimeoutOptions {
  readonly timeoutMs: number;
  readonly opName?: string;
  readonly onTimeout?: () => void;
}

/**
 * Execute an asynchronous operation bounded by a strict millisecond timeout.
 *
 * If the operation exceeds `timeoutMs`, the returned promise immediately rejects
 * with a `RedisStoreError` (code `'timeout'`).
 *
 * To prevent Node.js unhandled rejections, a suppression handler is attached
 * to the abandoned promise.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions,
): Promise<T> {
  const { timeoutMs, opName = 'Redis command', onTimeout } = options;

  if (timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    return promise;
  }

  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      // Attach silent catch handler to abandoned promise to avoid unhandledRejection
      promise.catch(() => {});
      reject(
        new RedisStoreError(
          `${opName} timed out after ${timeoutMs}ms. The command may still execute on the server.`,
          { code: 'timeout' },
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }
}
