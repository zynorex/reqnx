# ADR-0005: Public API, Result Shape & Headers

**Status:** Accepted  
**Date:** 2026-10-01

## Context

Rate-limit responses need standard HTTP headers. There are three competing conventions:
1. **RFC 9110 `Retry-After`** — well-established standard for 429 responses.
2. **IETF draft-ietf-httpapi-ratelimit-headers-11** (active Internet-Draft, May 2026) — defines `RateLimit` and `RateLimit-Policy` structured header fields.
3. **Legacy `X-RateLimit-*`** — de-facto convention used by GitHub, Twitter, etc.

## Decision

### Header strategy: emit both by default

`decisionToHeaders(decision, nowMs, options?)` returns headers based on `HeaderOptions.style`:

| Style | Headers |
|-------|---------|
| `'both'` (default) | `RateLimit` + `RateLimit-Policy` + `X-RateLimit-*` + `Retry-After` |
| `'draft'` | `RateLimit` + `RateLimit-Policy` + `Retry-After` |
| `'legacy'` | `X-RateLimit-*` + `Retry-After` |

### Header details

**`Retry-After`** (RFC 9110 §10.2.3):
- Only set when `allowed === false`
- Value: `ceil(retryAfterMs / 1000)` (seconds, integer)

**`RateLimit`** (draft-11):
- Structured field: `limit=100, remaining=42, reset=28`
- `reset` is seconds until the limit resets (integer, computed from `resetAtMs - nowMs`)

**`RateLimit-Policy`** (draft-11):
- Policy description: `100;w=60` (100 requests per 60-second window)
- For bucket algorithms where `w` isn't meaningful, we omit `w` and use just the limit

**Legacy `X-RateLimit-*`**:
- `X-RateLimit-Limit`: same as `limit`
- `X-RateLimit-Remaining`: same as `remaining`
- `X-RateLimit-Reset`: epoch seconds (Unix timestamp) when window resets

### Result shape: `Decision`

```typescript
interface Decision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAtMs: number;
  readonly retryAfterMs: number;
}
```

All fields are present on every decision (both allowed and denied). Per-algorithm semantics of `remaining`, `resetAtMs`, and `retryAfterMs` are documented in the `Decision` TSDoc table.

### Pure function in core

`decisionToHeaders()` is a pure, framework-free function in `@reqnx/core`. Express and Fastify adapters both call it — no duplication.

## Consequences

- Users get maximum compatibility out of the box (both draft and legacy headers)
- Easy to switch to draft-only when the RFC is published
- One function to test; adapters are thin wrappers
- `Retry-After` follows the actual standard (RFC 9110), not a custom convention

## Alternatives Considered

- **Draft-only**: Would break clients that rely on `X-RateLimit-*`. Rejected as default; available as an option.
- **Legacy-only**: Ignores the active IETF standardisation effort. Would need migration later. Rejected as default.
- **Separate header functions per adapter**: Code duplication, harder to keep consistent. Rejected.
- **Include `RateLimit-Remaining` / `RateLimit-Reset` as separate headers (old draft versions)**: The draft has moved to a single structured `RateLimit` field as of draft-07+. We follow the current draft.
