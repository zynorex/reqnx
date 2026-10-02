// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Error types
//
// Hierarchy:
//   RateLimitError (base)
//   ├── ConfigError   — invalid configuration (crash at startup)
//   ├── StoreError    — store I/O failure (caught by failure policy)
//   └── InputError    — bad per-call input (empty key, invalid cost)
//
// Cross-boundary instanceof via Symbol.for branding.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Well-known symbol for cross-ESM/CJS `instanceof` checks.
 *
 * `Symbol.for` guarantees the same symbol instance regardless of how many
 * copies of `@reqnx/core` are loaded, enabling correct `instanceof` even
 * when ESM and CJS bundles coexist in the same process.
 *
 * @internal
 */
const BRAND = Symbol.for('reqnx.error');

/**
 * Base class for all REQNX errors.
 *
 * Use `error instanceof RateLimitError` to catch any error originating
 * from `@reqnx/core`.
 *
 * ### Subclasses
 * - {@link ConfigError} — invalid configuration (programming error, crash at startup)
 * - {@link StoreError} — store I/O failure (caught by the limiter's failure policy)
 * - {@link InputError} — bad per-call input (empty key, invalid cost)
 *
 * ### Cross-boundary `instanceof`
 * Uses `Symbol.for('reqnx.error')` branding so that `instanceof` works
 * correctly even when ESM and CJS copies of `@reqnx/core` coexist in the
 * same process.
 */
export class RateLimitError extends Error {
  /** Machine-readable error code. Stable across versions. */
  readonly code: string = 'RATE_LIMIT_ERROR';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RateLimitError';
    Object.defineProperty(this, BRAND, {
      value: 'RateLimitError',
      enumerable: false,
      configurable: true,
    });
  }

  /**
   * Cross-boundary `instanceof` check.
   * Returns `true` for any REQNX error (RateLimitError, ConfigError,
   * StoreError, InputError).
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return typeof value === 'object' && value !== null && BRAND in value;
  }
}

/**
 * Thrown when algorithm config validation fails.
 *
 * This indicates a programming error — invalid config provided at limiter
 * construction or returned by a {@link ConfigResolver}. It should crash
 * loudly and is **not** caught by the limiter's error policy.
 *
 * @example
 * ```ts
 * throw new ConfigError('`max` must be a positive integer, got -5');
 * ```
 */
export class ConfigError extends RateLimitError {
  override readonly code = 'CONFIG_ERROR' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ConfigError';
    Object.defineProperty(this, BRAND, {
      value: 'ConfigError',
      enumerable: false,
      configurable: true,
    });
  }

  /**
   * Cross-boundary `instanceof` check for ConfigError specifically.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      BRAND in value &&
      (value as Record<symbol, unknown>)[BRAND] === 'ConfigError'
    );
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
export class StoreError extends RateLimitError {
  override readonly code = 'STORE_ERROR' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StoreError';
    Object.defineProperty(this, BRAND, {
      value: 'StoreError',
      enumerable: false,
      configurable: true,
    });
  }

  /**
   * Cross-boundary `instanceof` check for StoreError specifically.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      BRAND in value &&
      (value as Record<symbol, unknown>)[BRAND] === 'StoreError'
    );
  }
}

/**
 * Thrown when per-call input validation fails.
 *
 * Unlike {@link ConfigError} (which indicates a programming mistake caught
 * at construction), `InputError` represents bad per-call input that may be
 * attacker-influenced:
 * - Empty or oversized identity key
 * - Key containing control characters
 * - `cost` that is not a positive integer
 *
 * `InputError` is **not** caught by the limiter's failure policy — it
 * propagates to the caller. Middleware should catch it and return 400.
 *
 * @example
 * ```ts
 * throw new InputError('Identity key must not be empty');
 * ```
 */
export class InputError extends RateLimitError {
  override readonly code = 'INPUT_ERROR' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InputError';
    Object.defineProperty(this, BRAND, {
      value: 'InputError',
      enumerable: false,
      configurable: true,
    });
  }

  /**
   * Cross-boundary `instanceof` check for InputError specifically.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      BRAND in value &&
      (value as Record<symbol, unknown>)[BRAND] === 'InputError'
    );
  }
}
