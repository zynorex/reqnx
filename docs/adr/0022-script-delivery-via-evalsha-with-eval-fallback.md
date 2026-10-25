# ADR-0022: Script Delivery via EVALSHA with EVAL Fallback

## Status

Accepted

## Context

Executing Lua scripts over the network requires choosing between raw `EVAL`, cached `EVALSHA`, and Redis 7 Functions (`FUNCTION LOAD`). Redis script caches are volatile (cleared on failover, restart, or `SCRIPT FLUSH`). Redis Functions are persistent, but require elevated administrative permissions and deployment-time lifecycle orchestration that rate-limiting library consumers often lack.

## Decision

1. **Self-Healing `EVALSHA` with `EVAL` Fallback**:
   - Precompute 40-character hexadecimal SHA1 hashes locally in TypeScript via `crypto.createHash('sha1')`.
   - Execute scripts via `EVALSHA`.
   - On `NOSCRIPT` error, transparently catch and execute `EVAL` with the full script string (which automatically recompiles and populates the Redis script cache).
   - Subsequent calls resume using `EVALSHA` with zero runtime intervention.
2. **Script Warmup API (`store.warmup()`)**:
   - Optional method to execute `SCRIPT LOAD` across all registered algorithms upon startup or reconnection to avoid first-call `EVAL` overhead.
3. **Deferral of Redis Functions**:
   - Redis Functions require cluster-wide replication coordination and administrative ACL privileges that are inappropriate for an unprivileged rate limiting library.

## Consequences

- Completely self-healing under Redis failover, restarts, or maintenance flushes.
- Zero configuration, zero administrative setup required.
