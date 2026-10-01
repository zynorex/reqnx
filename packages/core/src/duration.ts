// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Duration parsing
//
// Type-only stub. Implementation on Day 2.
// ──────────────────────────────────────────────────────────────────────────────

import { type Duration } from './types.js';

/**
 * Parse a {@link Duration} value to milliseconds.
 *
 * Accepts:
 * - A `number` (treated as milliseconds, must be > 0)
 * - A string like `'30s'`, `'5m'`, `'1h'`, `'500ms'`, `'1d'`
 *
 * @param duration - The duration to parse.
 * @returns The duration in milliseconds.
 * @throws {ConfigError} if the value is invalid or non-positive.
 *
 * @example
 * ```ts
 * parseDuration(5000);   // 5000
 * parseDuration('30s');   // 30000
 * parseDuration('2m');    // 120000
 * ```
 */
export function parseDuration(_duration: Duration): number {
  // TODO: implement on Day 2
  throw new Error('Not implemented');
}
