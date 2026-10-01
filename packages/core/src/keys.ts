// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Key building utilities
//
// Type-only stub. Implementation on Day 2.
// ──────────────────────────────────────────────────────────────────────────────

import { type AlgorithmId } from './types.js';

/**
 * Maximum byte length for a full Redis/store key.
 *
 * Keys exceeding this limit have their identity portion SHA-256 hashed
 * (hex-encoded) and prefixed with `h:` to prevent:
 * - Excessive Redis memory consumption from attacker-controlled keys
 * - Exceeding Redis's internal key-length limits
 */
export const MAX_KEY_BYTES: 512 = 512;

/**
 * Build a fully-qualified rate-limit key.
 *
 * Format: `reqnx:{prefix}:{algorithmId}:{identity}`
 *
 * If the resulting key exceeds {@link MAX_KEY_BYTES}, the `identity` portion
 * is replaced with `h:{sha256hex}`.
 *
 * @param prefix      - User-chosen namespace (e.g. `'api'`). Must be non-empty
 *                       ASCII with no colons.
 * @param algorithmId - Algorithm identifier from {@link AlgorithmId}.
 * @param identity    - The caller-supplied key (IP, user ID, API key, etc.).
 *                       This is attacker-influenced and will be truncated/hashed
 *                       if too long.
 * @returns The fully-qualified key string.
 *
 * @example
 * ```ts
 * buildKey('api', 'fixed-window', '192.168.1.1');
 * // → 'reqnx:api:fixed-window:192.168.1.1'
 * ```
 */
export function buildKey(
  _prefix: string,
  _algorithmId: AlgorithmId,
  _identity: string,
): string {
  // TODO: implement on Day 2
  throw new Error('Not implemented');
}
