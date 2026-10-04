# ADR-0003: Redis Strategy

**Status:** Accepted  
**Date:** 2026-10-01

## Context

RedisStore must provide atomic rate limiting across multiple application instances. Redis Cluster imposes constraints on multi-key operations. Clock skew between app nodes must not affect decisions.

## Decision

### Lua scripts for atomicity

Each algorithm has a dedicated Lua script that:

1. Reads the current state from a single Redis key
2. Computes the decision (equivalent to the TS `step()` function)
3. Writes the new state back
4. Sets `PEXPIRE` based on `stateTtlMs`
5. Returns `[allowed, limit, remaining, resetAtMs, retryAfterMs]`

Scripts are loaded via `EVALSHA` (with `EVAL` fallback) for efficiency.

### Single-key state

Per-identity state lives in **one Redis key** (a hash or sorted set depending on the algorithm). This makes scripts single-key, which means:

- They're atomic without `MULTI/EXEC` or `WATCH`
- They work on Redis Cluster without restrictions (single-key scripts always run on the shard that owns the key)

### Clock: Redis `TIME`

Lua scripts use `redis.call('TIME')` to get the current server time instead of relying on the app's clock. This eliminates clock-skew issues between app instances.

For **testing**, scripts accept an optional explicit `nowMs` argument. When provided, it overrides `TIME`, enabling deterministic conformance tests.

### Key schema

```
reqnx:{prefix}:{algorithmId}:{identity}
```

- `prefix`: user-chosen namespace (validated: non-empty ASCII, no colons)
- `algorithmId`: from `Algorithm.id`
- `identity`: caller-supplied; oversized keys (>512 bytes) are rejected with `InputError` (never silently hashed or truncated). Operators handling long inputs should pre-hash.

### Valkey compatibility

Lua scripts use only standard Redis commands and Lua 5.1 features. No Redis modules or Redis 7-only APIs. Compatible with Valkey (Redis fork).

### Algorithm ID lookup

RedisStore maintains a registry: `Map<AlgorithmId, string>` mapping algorithm IDs to Lua script SHAs. If no script exists for a given algorithm ID, `createLimiter` fails fast with a `ConfigError`.

## Consequences

- Cross-process atomicity without WATCH/retry loops
- Redis Cluster compatible out of the box
- No clock-skew issues between app nodes
- Lua scripts must be maintained in parallel with TS step functions
- Conformance suite catches drift between TS and Lua implementations

## Alternatives Considered

- **WATCH/MULTI/EXEC**: Retries under contention, poor performance. Rejected.
- **RedLock for distributed locking**: Overkill for per-key rate limiting; adds latency and complexity. Rejected.
- **Multi-key scripts**: Would require `{hash-tag}` for Cluster; single-key is simpler and always works.
- **App-side clock**: Would cause disagreements between instances with clock skew. Rejected.
