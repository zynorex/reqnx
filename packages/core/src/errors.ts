// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Error types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when algorithm config validation fails.
 *
 * This indicates a programming error — invalid config provided at limiter
 * construction or returned by a {@link ConfigResolver}. It should crash
 * loudly and is not caught by the limiter's error policy.
 *
 * @example
 * ```ts
 * throw new ConfigError('`max` must be a positive integer, got -5');
 * ```
 */
export class ConfigError extends Error {
  readonly code = 'CONFIG_ERROR' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ConfigError';
  }
}

/**
 * Thrown (internally) when a {@link Store} operation fails due to I/O,
 * connection, or script errors.
 *
 * A `StoreError` **never escapes the Limiter** to the caller. It is
 * intercepted and handled by the configured {@link StoreErrorPolicy}:
 * - `'fail-open'` (default): allow the request
 * - `'fail-closed'`: deny the request
 * - Custom handler: returns a user-defined {@link Decision}
 *
 * The error is always reported via the `onError` hook.
 */
export class StoreError extends Error {
  readonly code = 'STORE_ERROR' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StoreError';
  }
}
