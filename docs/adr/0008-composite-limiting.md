# ADR-0008: Composite Limiting

**Status:** Proposed (implementation Day 8)  
**Date:** 2026-10-01

## Context

Real-world APIs often enforce multiple rate limits simultaneously (e.g. 10 req/s AND 1000 req/h). When one rule denies, the others must not have consumed tokens ("no leaked consumption"). This must work with both MemoryStore and RedisStore, including Redis Cluster.

## Decision

### Composite limiter as a higher-order `Limiter`

A composite limiter wraps N child `Limiter` instances. It does NOT introduce a new `Store` method or modify the `Algorithm` contract.

```typescript
function createCompositeLimiter(options: {
  limiters: Limiter[];
  onStoreError?: StoreErrorPolicy;
  hooks?: LimiterHooks;
}): Limiter;
```

### Two-phase check (peek-then-consume)

1. **Phase 1: Peek all.** Call `limiter.peek(key)` on every child limiter.
   - If ANY peek returns `allowed: false`, return the most restrictive denial immediately. No consumption happens.
2. **Phase 2: Consume all.** Call `limiter.check(key, { cost })` on every child limiter.
   - If ALL succeed, return the most restrictive `Decision` (lowest `remaining`).
   - If one fails (store error), apply the composite's `onStoreError` policy.

### Race condition acknowledgment

Between peek and consume, another request could have consumed tokens, causing a consume to fail that the peek said would succeed. This is an **accepted tradeoff**:
- It can only result in an extra denial (conservative), never an extra allow.
- It's extremely rare in practice (would require two requests for the same key within the peek→consume round-trip).
- The alternative (multi-key Redis transaction) is far more complex and breaks Cluster compatibility.

### Redis Cluster implications

If child limiters use different algorithm IDs, their Redis keys will naturally land on different shards:
```
reqnx:api:fixed-window:user-123    → shard A
reqnx:api:token-bucket:user-123   → shard B
```

To use a multi-key Lua script (future optimisation), all keys would need to hash to the same slot via a hash tag: `{reqnx:api}:fixed-window:user-123`. 

**For v0.1.0, we use the peek-then-consume approach** (no multi-key scripts). This works on Cluster without hash tags but has the small race window described above.

**Future optimisation:** A composite Lua script that operates on multiple keys with the same `{hash-tag}` prefix. This would be truly atomic but restricts all keys to one shard. Document the hotspot risk.

### Return value

The composite `check()` returns the **most restrictive** `Decision`:
- `allowed`: true only if ALL children allow
- `limit`: minimum of all children's limits
- `remaining`: minimum of all children's remaining
- `resetAtMs`: maximum of all children's resetAtMs (latest reset)
- `retryAfterMs`: maximum of all children's retryAfterMs (longest wait)

## Consequences

- No changes to `Algorithm`, `Store`, or `Decision` contracts
- Works on Redis Cluster without hash tags
- Small theoretical race window (conservative direction only)
- Simple implementation: just wraps existing `Limiter` instances
- Future atomic composite can be added as an optimisation without breaking the API

## Alternatives Considered

- **Multi-key Lua script**: Truly atomic but requires hash tags, restricts to one shard, creates hotspots. Deferred.
- **New `Store.consumeMulti()` method**: Pollutes the Store interface for a feature not all stores need. Rejected.
- **Consume-then-rollback**: Consume all, if one denies, rollback the others. More complex, rollback itself can fail. Rejected.
- **Application-level locking**: Adds latency, single point of failure. Rejected.
