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

| Policy                                | Behaviour                                   |
| ------------------------------------- | ------------------------------------------- |
| `'fail-open'` (default)               | Allow the request. Log the error.           |
| `'fail-closed'`                       | Deny the request with a synthetic Decision. |
| Custom `(error, context) => Decision` | User-defined logic.                         |

A throwing custom handler is treated as `'fail-open'` (safety net).

The `onError` hook is always called, regardless of policy.

### ConfigError: crash loudly

`ConfigError` is thrown by `parseConfig()` and is **not** caught by the limiter. It indicates a programming error and should crash at startup (or at first call for resolver-based configs).

### Memory protection

**MemoryStore:**

- `maxKeys` option (default: 100,000). When exceeded, keys are randomly evicted until under the cap.
- TTL sweep runs on a configurable interval (default: 60s). Expired keys are removed.
- Random eviction was chosen over LRU for simplicity. Under uniform load distributions, random eviction provides comparable hit rates with significantly less overhead.

**Redis keys:**

- Max key length: 512 bytes. Oversized keys are SHA-256 hashed.
- `PEXPIRE` set via `stateTtlMs()` ensures automatic cleanup.

## Consequences

- No try/catch needed for rate-limit checks in app code
- Store outages don't crash the app (fail-open by default)
- Memory-bounded even under key-enumeration attacks
- Random eviction may evict "better" keys than LRU in skewed distributions, but the simplicity tradeoff is worth it for v0.1.0

## Alternatives Considered

- **Throw on denial**: Forces try/catch in every middleware, error-prone. Rejected.
- **LRU eviction for MemoryStore**: Requires a doubly-linked list + map, ~2x memory overhead per key. Deferred; can be added as an option later.
- **No maxKeys cap**: Attacker can exhaust process memory by cycling through unique keys. Rejected.
