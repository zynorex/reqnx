// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Decision → HTTP headers
//
// Pure, framework-free function shared by Express and Fastify adapters.
// Type-only stub. Implementation on Day 7.
// ──────────────────────────────────────────────────────────────────────────────

import { type Decision, type HeaderOptions, type RateLimitHeaders } from './types.js';

/**
 * Convert a rate-limit {@link Decision} into HTTP response headers.
 *
 * This is a **pure function** with no framework dependency. It is shared
 * by the Express and Fastify adapters.
 *
 * ### Header strategy (see ADR-0005)
 *
 * By default (`style: 'both'`), emits:
 *
 * 1. **`Retry-After`** (RFC 9110 §10.2.3) — only when `allowed === false`.
 *    Value is `ceil(retryAfterMs / 1000)` in seconds.
 *
 * 2. **`RateLimit`** (IETF draft-ietf-httpapi-ratelimit-headers-11) —
 *    structured field: `limit=100, remaining=42, reset=28`.
 *
 * 3. **`RateLimit-Policy`** (same draft) — e.g. `100;w=60`.
 *
 * 4. **`X-RateLimit-Limit`**, **`X-RateLimit-Remaining`**,
 *    **`X-RateLimit-Reset`** — legacy de-facto convention.
 *
 * @param decision - The rate-limit decision.
 * @param nowMs    - Current time in epoch ms, for computing relative seconds.
 * @param options  - Which header families to include.
 * @returns An object of header name → string value pairs.
 */
export function decisionToHeaders(
  _decision: Decision,
  _nowMs: number,
  _options?: HeaderOptions,
): RateLimitHeaders {
  // TODO: implement on Day 7
  throw new Error('Not implemented');
}
