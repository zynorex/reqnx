// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Self-Healing Script Runner
//
// Manages local SHA1 hashing, EVALSHA execution, transparent fallback to
// EVAL upon NOSCRIPT, script preloading, and execution telemetry.
// ──────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { type RedisClientAdapter, type RedisStoreStats } from './types.js';
import { isNoScriptError, mapRedisError, RedisStoreError } from './adapters/base.js';

/**
 * Compute the 40-character hexadecimal SHA1 hash of a Lua script string.
 */
export function computeSha1(script: string): string {
  return createHash('sha1').update(script).digest('hex');
}

/**
 * Executes Lua scripts using `EVALSHA`, falling back to `EVAL` on `NOSCRIPT`.
 */
export class ScriptRunner {
  private _evalshaCalls = 0;
  private _evalFallbacks = 0;
  private _errors = {
    connection: 0,
    timeout: 0,
    script: 0,
    wrongType: 0,
    corruptState: 0,
    timeRejected: 0,
    other: 0,
  };

  /**
   * Execute a script with EVALSHA and automatic EVAL fallback.
   */
  async runScript(
    adapter: RedisClientAdapter,
    sha: string,
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<unknown> {
    if (adapter.isClosed()) {
      this._errors.connection++;
      throw new RedisStoreError('Cannot execute Redis script: client connection is closed.', {
        code: 'REQNX_CLIENT_CLOSED',
      });
    }

    try {
      const reply = await adapter.evalSha(sha, keys, args);
      this._evalshaCalls++;
      return reply;
    } catch (err) {
      if (isNoScriptError(err)) {
        this._evalFallbacks++;
        try {
          return await adapter.eval(script, keys, args);
        } catch (evalErr) {
          this.trackError(evalErr);
          throw mapRedisError(evalErr);
        }
      }

      this.trackError(err);
      throw mapRedisError(err);
    }
  }

  /**
   * Execute a read-only script with EVALSHA and automatic EVAL fallback.
   */
  async runReadOnlyScript(
    adapter: RedisClientAdapter,
    sha: string,
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<unknown> {
    if (adapter.isClosed()) {
      this._errors.connection++;
      throw new RedisStoreError('Cannot execute Redis script: client connection is closed.', {
        code: 'REQNX_CLIENT_CLOSED',
      });
    }

    const runSha = adapter.evalShaReadOnly
      ? (s: string, k: string[], a: (string | number)[]) => adapter.evalShaReadOnly!(s, k, a)
      : (s: string, k: string[], a: (string | number)[]) => adapter.evalSha(s, k, a);

    const runRaw = adapter.evalReadOnly
      ? (sc: string, k: string[], a: (string | number)[]) => adapter.evalReadOnly!(sc, k, a)
      : (sc: string, k: string[], a: (string | number)[]) => adapter.eval(sc, k, a);

    try {
      const reply = await runSha(sha, keys, args);
      this._evalshaCalls++;
      return reply;
    } catch (err) {
      if (isNoScriptError(err)) {
        this._evalFallbacks++;
        try {
          return await runRaw(script, keys, args);
        } catch (evalErr) {
          this.trackError(evalErr);
          throw mapRedisError(evalErr);
        }
      }

      this.trackError(err);
      throw mapRedisError(err);
    }
  }

  /**
   * Preload a script into Redis with SCRIPT LOAD.
   */
  async preload(adapter: RedisClientAdapter, script: string): Promise<string> {
    if (typeof adapter.scriptLoad === 'function') {
      try {
        return await adapter.scriptLoad(script);
      } catch (err) {
        this.trackError(err);
        throw mapRedisError(err);
      }
    }
    return computeSha1(script);
  }

  /**
   * Read execution counters and error statistics.
   */
  getStats(): RedisStoreStats {
    return {
      evalshaCalls: this._evalshaCalls,
      evalFallbacks: this._evalFallbacks,
      errors: { ...this._errors },
    };
  }

  private trackError(err: unknown): void {
    const code = err instanceof RedisStoreError ? err.code : '';
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

    if (code === 'REQNX_CONNECTION_ERROR' || msg.includes('connection')) {
      this._errors.connection++;
    } else if (code === 'REQNX_COMMAND_TIMEOUT' || msg.includes('timeout')) {
      this._errors.timeout++;
    } else if (code === 'REQNX_WRONGTYPE' || msg.includes('wrongtype')) {
      this._errors.wrongType++;
    } else if (code === 'REQNX_CORRUPT_STATE') {
      this._errors.corruptState++;
    } else if (code === 'REQNX_TIME_REJECTED') {
      this._errors.timeRejected++;
    } else if (code === 'REQNX_SCRIPT_ERROR') {
      this._errors.script++;
    } else {
      this._errors.other++;
    }
  }
}
