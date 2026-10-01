// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — createLimiter factory
//
// Type-only stub. Implementation on Day 2.
// ──────────────────────────────────────────────────────────────────────────────

import { type Limiter, type LimiterOptions } from './types.js';

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
 * import { createLimiter } from '@reqnx/core';
 * import { fixedWindow } from '@reqnx/core/algorithms';
 * import { MemoryStore } from '@reqnx/core';
 *
 * const limiter = createLimiter({
 *   algorithm: fixedWindow,
 *   store: new MemoryStore(),
 *   prefix: 'api',
 *   config: { max: 100, window: '1m' },
 * });
 *
 * const decision = await limiter.check('user-123');
 * if (!decision.allowed) {
 *   // rate limited
 * }
 * ```
 */
export function createLimiter<Config, State>(
  _options: LimiterOptions<Config, State>,
): Limiter {
  // TODO: implement on Day 2
  throw new Error('Not implemented');
}
