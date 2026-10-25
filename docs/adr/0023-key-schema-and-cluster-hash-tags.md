# ADR-0023: Key Schema & Cluster Hash Tags

## Status

Accepted

## Context

In Redis Cluster, keys are assigned to 16,384 hash slots based on CRC16 hashing. Hash tags `{...}` force keys to the same shard for multi-key atomicity. However, single-key rate limit operations route directly to whichever shard owns the key.

## Decision

1. **Key Schema**:
   `reqnx:{prefix}:{algorithmId}:{identity}`
2. **Omission of Hash Tags for Single-Key Rate Limiting**:
   - Single-key rate limiting operations (`fixedWindow`, `tokenBucket`, `slidingWindowLog`, `slidingWindowCounter`) operate on exactly one key (`KEYS[1]`).
   - Using hash tags on single keys (e.g. `{identity}`) would concentrate all algorithms and prefixes for that identity onto one shard without benefit. Omitting hash tags allows Redis Cluster to distribute keys uniformly across all cluster master nodes.
3. **Multi-Key Operations (Day 8 Composite Limiters)**:
   - When multi-key composite rate limits are evaluated in a single script on Redis Cluster, hash tags will be explicitly applied to ensure slot collocation.

## Consequences

- Maximum horizontal scaling and even CPU utilization across Redis Cluster shards.
- Uniform key schema across standalone, Sentinel, and Cluster topologies.
