# ADR-0004: Failure Semantics

**Status:** Accepted  
**Date:** 2026-10-01

## Context

Rate limiters must handle two failure modes: (1) a request is denied by the algorithm (a normal outcome, not an error) and (2) the store fails (connection lost, Lua script error, timeout). The system must also handle attacker-controlled keys that could exhaust memory.

## Decision

### Denied requests are values, not exceptions

A denied request returns `Decision { allowed: false, ... }`. It is never an exception. This makes the happy path and the rate-limited path use the same code shape:

```typescript
const decision = await limiter.check(key);
if (!decision.allowed) {
  res.status(429).set(decisionToHeaders(decision, Date.now())).end();
}
```

### Store errors: configurable policy

When a `Store` operation throws, the limiter catches it as a `StoreError` and applies the configured `onStoreError` policy:

| Policy                                | Behaviour                                                |
| ------------------------------------- | -------------------------------------------------------- |
| `'fail-open'` (default)               | Allow the request (`degraded: true`). Log the error.     |
| `'fail-closed'`                       | Deny the request (`degraded: true`). Synthetic decision. |
| Custom `(error, context) => Decision` | User-defined logic (`degraded: true` automatically set). |

A throwing custom handler is treated as `'fail-open'` (safety net) with `degraded: true`.

The `onError` hook is always called, regardless of policy. In addition, the returned `Decision` includes `degraded: true`, signalling to HTTP middleware not to emit synthetic rate limit headers.

### Error taxonomy

- **`RateLimitError`**: Base class for all REQNX errors. Uses `Symbol.for('reqnx.error')` branding for cross-ESM/CJS `instanceof` reliability.
- **`ConfigError`**: Thrown by `parseConfig()` and limiter construction. Indicates a programming mistake caught at startup. Not caught by the failure policy.
- **`InputError`**: Thrown for bad per-call input (empty key, control characters, non-positive integer cost). Propagates to the caller so HTTP middleware can respond with HTTP 400 Bad Request.
- **`StoreError`**: Internal store failure. Caught by the limiter and mapped to the configured `onStoreError` policy.

### Memory protection

**MemoryStore (see ADR-0009):**

- `maxKeys` option (default: 100,000). When capacity is reached, expired entries are purged; if still full, LRU eviction removes the oldest unexpired key.
- Incremental sweep runs every `sweepIntervalOps` (default: 1,000 operations), checking up to `sweepBatchSize` (500) entries. No background timers are used.

**Keys:**

- Max key length: 512 bytes. Oversized keys are rejected with `InputError` (never silently hashed or truncated).

## Consequences

- No try/catch needed for rate-limit checks in app code.
- Store outages don't crash the app (fail-open by default).
- Middleware can check `decision.degraded` to suppress misleading HTTP headers during outages.
- Memory is strictly bounded even under key-enumeration attacks.
