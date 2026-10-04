// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — createLimiter factory
//
// Wires an Algorithm to a Store and exposes the framework-agnostic Limiter API.
// ──────────────────────────────────────────────────────────────────────────────

import { type CheckOptions, type Decision, type Limiter, type LimiterOptions } from './types.js';
import { ConfigError, InputError, StoreError } from './errors.js';
import { buildKey, validateIdentity } from './keys.js';

/** Printable ASCII excluding `:` (0x21-0x7E minus 0x3A). */
const VALID_PREFIX_RE = /^[!-9;-~]+$/;

function safeNow(): number {
  return performance.now();
}

function safeCallHook(fn: (() => void | Promise<void>) | undefined): void {
  if (!fn) return;
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Limiter hook rejected:', err);
      });
    }
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('Limiter hook threw:', err);
  }
}

/**
 * Create a configured rate limiter instance.
 *
 * This factory wires an {@link Algorithm} to a {@link Store} and returns
 * a framework-agnostic {@link Limiter} with `check()`, `peek()`, and
 * `reset()` methods.
 *
 * ### Validation
 * - If `config` is provided, it is validated eagerly via `algorithm.parseConfig()`.
 * - If `resolver` is provided, its output is validated per-call.
 * - Exactly one of `config` or `resolver` must be set.
 * - The `prefix` must be non-empty ASCII with no colons.
 *
 * ### Error handling
 * - {@link ConfigError} is thrown at construction for invalid config or prefix.
 * - {@link StoreError} during `check()`/`peek()` is intercepted and handled
 *   by the configured `onStoreError` policy (default: `'fail-open'`).
 * - Observability hooks (`onDecision`, `onError`) are called but a throwing
 *   hook never affects the returned decision.
 *
 * @throws {ConfigError} if config validation fails or prefix is invalid.
 *
 * @example
 * ```ts
 * import { createLimiter, createMemoryStore } from '@reqnx/core';
 * import { fixedWindow } from '@reqnx/core/algorithms';
 *
 * const limiter = createLimiter({
 *   algorithm: fixedWindow,
 *   store: createMemoryStore(),
 *   prefix: 'api',
 *   config: { max: 100, window: '1m' },
 * });
 *
 * const decision = await limiter.check('user-123');
 * ```
 */
export function createLimiter<Config, State>(options: LimiterOptions<Config, State>): Limiter {
  if (!options || typeof options !== 'object') {
    throw new ConfigError('Limiter options must be an object.');
  }

  const { algorithm, store, prefix, onStoreError = 'fail-open', hooks } = options;

  if (!algorithm || typeof algorithm !== 'object') {
    throw new ConfigError('Algorithm is required.');
  }
  if (!store || typeof store !== 'object') {
    throw new ConfigError('Store is required.');
  }

  // Prefix validation (must throw ConfigError at construction)
  if (typeof prefix !== 'string' || prefix.length === 0) {
    throw new ConfigError('Prefix must be non-empty.');
  }
  if (!VALID_PREFIX_RE.test(prefix)) {
    throw new ConfigError(
      `Prefix "${prefix}" contains invalid characters. ` +
        'Only printable ASCII (0x21–0x7E) excluding colon is allowed.',
    );
  }

  // Config vs Resolver exclusivity
  const hasConfig = options.config !== undefined;
  const hasResolver = typeof options.resolver === 'function';

  if ((hasConfig && hasResolver) || (!hasConfig && !hasResolver)) {
    throw new ConfigError('Exactly one of `config` or `resolver` must be provided.');
  }

  // Eager validation of static config
  let staticConfig: Config;
  if (hasConfig) {
    try {
      staticConfig = algorithm.parseConfig(options.config);
    } catch (err: unknown) {
      if (err instanceof ConfigError) {
        throw err;
      }
      throw new ConfigError(
        `Invalid algorithm config: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  async function resolveConfig(key: string): Promise<Config> {
    if (hasConfig) {
      return staticConfig;
    }
    const rawConfig = await options.resolver!(key);
    return algorithm.parseConfig(rawConfig);
  }

  function handleStoreError(err: unknown, key: string, cost: number, startTime: number): Decision {
    const storeError =
      err instanceof StoreError
        ? err
        : new StoreError(err instanceof Error ? err.message : String(err), {
            cause: err,
          });

    let decision: Decision;

    if (typeof onStoreError === 'function') {
      try {
        const custom = onStoreError(storeError, {
          key,
          cost,
          algorithmId: algorithm.id,
        });
        decision = {
          allowed: custom.allowed,
          limit: custom.limit,
          remaining: custom.remaining,
          resetAtMs: custom.resetAtMs,
          retryAfterMs: custom.retryAfterMs,
          degraded: true,
        };
      } catch (handlerErr: unknown) {
        // eslint-disable-next-line no-console
        console.error('Custom error handler threw:', handlerErr);
        decision = {
          allowed: true,
          limit: 0,
          remaining: 0,
          resetAtMs: 0,
          retryAfterMs: 0,
          degraded: true,
        };
      }
    } else if (onStoreError === 'fail-closed') {
      decision = {
        allowed: false,
        limit: 0,
        remaining: 0,
        resetAtMs: 0,
        retryAfterMs: 0,
        degraded: true,
      };
    } else {
      // 'fail-open' (default)
      decision = {
        allowed: true,
        limit: 0,
        remaining: 0,
        resetAtMs: 0,
        retryAfterMs: 0,
        degraded: true,
      };
    }

    safeCallHook(() =>
      hooks?.onError?.({
        key,
        algorithmId: algorithm.id,
        error: storeError,
        fallbackDecision: decision,
      }),
    );

    const durationMs = safeNow() - startTime;
    safeCallHook(() =>
      hooks?.onDecision?.({
        key,
        algorithmId: algorithm.id,
        decision,
        cost,
        durationMs,
      }),
    );

    return decision;
  }

  return {
    async check(key: string, opts?: CheckOptions): Promise<Decision> {
      validateIdentity(key);

      const cost = opts?.cost ?? 1;
      if (typeof cost !== 'number' || !Number.isInteger(cost) || cost < 1) {
        throw new InputError(`Cost must be a positive integer, got ${cost}.`);
      }

      const storageKey = buildKey(prefix, algorithm.id, key);
      const config = await resolveConfig(key);

      const startTime = safeNow();
      let decision: Decision;
      try {
        decision = await store.consume(algorithm, storageKey, config, cost);
      } catch (err: unknown) {
        return handleStoreError(err, key, cost, startTime);
      }

      const durationMs = safeNow() - startTime;
      safeCallHook(() =>
        hooks?.onDecision?.({
          key,
          algorithmId: algorithm.id,
          decision,
          cost,
          durationMs,
        }),
      );

      return decision;
    },

    async peek(key: string): Promise<Decision> {
      validateIdentity(key);

      const storageKey = buildKey(prefix, algorithm.id, key);
      const config = await resolveConfig(key);

      const startTime = safeNow();
      let decision: Decision;
      try {
        decision = await store.peek(algorithm, storageKey, config);
      } catch (err: unknown) {
        return handleStoreError(err, key, 0, startTime);
      }

      const durationMs = safeNow() - startTime;
      safeCallHook(() =>
        hooks?.onDecision?.({
          key,
          algorithmId: algorithm.id,
          decision,
          cost: 0,
          durationMs,
        }),
      );

      return decision;
    },

    async reset(key: string): Promise<void> {
      validateIdentity(key);
      const storageKey = buildKey(prefix, algorithm.id, key);
      await store.reset(storageKey);
    },
  };
}
