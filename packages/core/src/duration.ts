// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Duration parsing
//
// Converts Duration values (number | string) to positive integer milliseconds.
// ──────────────────────────────────────────────────────────────────────────────

import { type Duration } from './types.js';
import { ConfigError } from './errors.js';

/**
 * Maximum duration allowed: 366 days in milliseconds.
 *
 * Durations exceeding this cap are rejected with a {@link ConfigError}.
 * This prevents accidental misconfiguration (e.g. a 100-year TTL).
 */
export const MAX_DURATION_MS: number = 366 * 24 * 60 * 60 * 1000; // 31_622_400_000

/** Multipliers for each supported unit suffix. */
const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Strict regex for duration strings.
 *
 * Format: `<number><unit>` where number is a positive decimal
 * (integer or fractional) and unit is one of `ms`, `s`, `m`, `h`, `d`.
 *
 * - No whitespace allowed (leading, trailing, or internal).
 * - No leading `+` or `-` sign.
 * - No exponential notation.
 */
const DURATION_RE = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/;

const ACCEPTED_FORMATS =
  'Accepted formats: a positive integer (milliseconds), or a string ' +
  'like "500ms", "30s", "2m", "1h", "1d". No whitespace, negatives, ' +
  'NaN, or Infinity. Maximum: 366 days (31622400000 ms).';

/**
 * Parse a {@link Duration} value to milliseconds.
 *
 * Accepts:
 * - A `number` (treated as milliseconds, must be a positive integer ≤ 366 days)
 * - A string like `'30s'`, `'5m'`, `'1h'`, `'500ms'`, `'1d'`
 *
 * @param duration - The duration to parse.
 * @returns The duration as a positive integer in milliseconds.
 * @throws {ConfigError} if the value is invalid, non-positive, fractional ms,
 *   or exceeds the 366-day cap.
 *
 * @example
 * ```ts
 * parseDuration(5000);    // 5000
 * parseDuration('30s');   // 30000
 * parseDuration('2m');    // 120000
 * parseDuration('0.5s');  // 500
 * ```
 */
export function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return validateMs(duration, String(duration));
  }

  if (typeof duration !== 'string') {
    throw new ConfigError(
      `Invalid duration: expected a number or string, got ${typeof duration}. ${ACCEPTED_FORMATS}`,
    );
  }

  const match = DURATION_RE.exec(duration);
  if (!match) {
    throw new ConfigError(`Invalid duration: "${duration}". ${ACCEPTED_FORMATS}`);
  }

  const value = Number(match[1]);
  const unit = match[2]!;
  const multiplier = UNIT_MS[unit]!;
  const ms = value * multiplier;

  return validateMs(ms, `"${duration}"`);
}

/**
 * Validate that a millisecond value is a positive, finite, whole integer
 * within the allowed cap.
 *
 * @internal
 */
function validateMs(ms: number, source: string): number {
  if (!Number.isFinite(ms)) {
    throw new ConfigError(`Invalid duration: ${source} resolved to ${ms}. ${ACCEPTED_FORMATS}`);
  }

  if (ms <= 0) {
    throw new ConfigError(
      `Invalid duration: ${source} must be positive (got ${ms} ms). ${ACCEPTED_FORMATS}`,
    );
  }

  if (!Number.isInteger(ms)) {
    throw new ConfigError(
      `Invalid duration: ${source} resolves to ${ms} ms which is not a whole ` +
        `number of milliseconds. ${ACCEPTED_FORMATS}`,
    );
  }

  if (ms > MAX_DURATION_MS) {
    throw new ConfigError(
      `Invalid duration: ${source} (${ms} ms) exceeds the maximum of ` +
        `366 days (${MAX_DURATION_MS} ms). ${ACCEPTED_FORMATS}`,
    );
  }

  return ms;
}
