// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Key building & validation
//
// Key schema:  reqnx:{prefix}:{algorithmId}:{identity}
// Delimiter-free prefix/algorithmId charset prevents cross-prefix collisions.
// Oversized keys are rejected (never silently hashed or truncated).
// ──────────────────────────────────────────────────────────────────────────────

import { type AlgorithmId } from './types.js';
import { InputError } from './errors.js';

/**
 * Maximum byte length for a full store key.
 *
 * Keys exceeding this limit are rejected with {@link InputError}.
 * Operators whose identity strings may exceed this limit should
 * pre-hash on their side.
 */
export const MAX_KEY_BYTES: 512 = 512;

/**
 * Options for {@link buildKey}.
 */
export interface KeyOptions {
  /**
   * Maximum byte length for the fully-qualified key.
   * @default 512
   */
  maxKeyBytes?: number;
}

/** Shared TextEncoder instance. */
const encoder = new TextEncoder();

/**
 * Printable ASCII excluding `:` (the key delimiter).
 * Range: `!` (0x21) through `~` (0x7E), minus `:` (0x3A).
 */
const VALID_PREFIX_RE = /^[!-9;-~]+$/;

/** Control characters: 0x00–0x1F and 0x7F. */
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/;

/**
 * Validate that a prefix string is safe for use in the key schema.
 *
 * Rules:
 * - Non-empty
 * - Printable ASCII only (0x21–0x7E)
 * - No colons (the key delimiter)
 *
 * @param prefix - The prefix to validate.
 * @throws {InputError} if the prefix is invalid.
 */
export function validatePrefix(prefix: string): void {
  if (prefix.length === 0) {
    throw new InputError('Prefix must be non-empty. Use printable ASCII characters (no colons).');
  }
  if (!VALID_PREFIX_RE.test(prefix)) {
    throw new InputError(
      `Prefix "${prefix}" contains invalid characters. ` +
        'Only printable ASCII (0x21–0x7E) excluding colon is allowed.',
    );
  }
}

/**
 * Validate that an identity string is safe for use as a rate-limit key.
 *
 * Rules:
 * - Non-empty
 * - No control characters (0x00–0x1F, 0x7F)
 *
 * @param identity - The identity string to validate.
 * @throws {InputError} if the identity is invalid.
 */
export function validateIdentity(identity: string): void {
  if (identity.length === 0) {
    throw new InputError('Identity key must not be empty.');
  }
  if (CONTROL_CHARS_RE.test(identity)) {
    throw new InputError('Identity key must not contain control characters (0x00–0x1F, 0x7F).');
  }
}

/**
 * Build a fully-qualified rate-limit key.
 *
 * Format: `reqnx:{prefix}:{algorithmId}:{identity}`
 *
 * Validates all components and rejects oversized keys. Keys are never
 * silently truncated or hashed — this is the operator's responsibility.
 *
 * @param prefix      - User-chosen namespace (e.g. `'api'`). Must be non-empty
 *                       printable ASCII with no colons.
 * @param algorithmId - Algorithm identifier from {@link AlgorithmId}.
 * @param identity    - The caller-supplied key (IP, user ID, API key, etc.).
 *                       Must be non-empty with no control characters.
 * @param options     - Optional configuration.
 * @returns The fully-qualified key string.
 * @throws {InputError} if any component is invalid or the key exceeds
 *   the maximum byte length.
 *
 * @example
 * ```ts
 * buildKey('api', 'fixed-window', '192.168.1.1');
 * // → 'reqnx:api:fixed-window:192.168.1.1'
 * ```
 */
export function buildKey(
  prefix: string,
  algorithmId: AlgorithmId,
  identity: string,
  options?: KeyOptions,
): string {
  validatePrefix(prefix);
  validateIdentity(identity);

  const key = `reqnx:${prefix}:${algorithmId}:${identity}`;
  const maxBytes = options?.maxKeyBytes ?? MAX_KEY_BYTES;
  const byteLength = encoder.encode(key).byteLength;

  if (byteLength > maxBytes) {
    throw new InputError(
      `Key exceeds maximum length of ${maxBytes} bytes (got ${byteLength} bytes). ` +
        `Full key: "${key.length > 80 ? key.slice(0, 77) + '...' : key}". ` +
        'Consider pre-hashing long identity strings on the caller side.',
    );
  }

  return key;
}

/**
 * Validate that an identity key is well-formed without throwing.
 *
 * Checks:
 * - Non-empty string
 * - Contains no control characters (0x00–0x1F, 0x7F)
 * - Byte length does not exceed `maxKeyBytes` (default: 512)
 *
 * @param identity - The identity string to test.
 * @param options  - Optional configuration.
 * @returns `true` if valid, `false` otherwise.
 */
export function validateKey(identity: string, options?: KeyOptions): boolean {
  if (typeof identity !== 'string' || identity.length === 0) {
    return false;
  }
  if (CONTROL_CHARS_RE.test(identity)) {
    return false;
  }
  const maxBytes = options?.maxKeyBytes ?? MAX_KEY_BYTES;
  return encoder.encode(identity).byteLength <= maxBytes;
}
