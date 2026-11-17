---
title: 'Leaky Bucket Redis Lua Port Specification'
summary: 'Technical architecture and parameter mapping for the Redis Lua port of leakyBucket.'
status: 'implemented'
---

# Leaky Bucket Redis Lua Port Specification

The Redis port for `leakyBucket` (`leakyBucketRedisPort`) executes on Redis using server-side Lua scripts for atomic, lock-free evaluation.

---

## Architectural Script Sharing

Because the Leaky Bucket meter and Token Bucket share an exact mathematical machine ([ADR-0027](file:///d:/zynorex%20Github/reqnx/docs/adr/0027-leaky-bucket-meter-and-token-bucket-equivalence.md)), `leakyBucketRedisPort` **reuses the compiled Token Bucket Lua scripts directly from the registry** (`TOKEN_BUCKET_CONSUME_SCRIPT` and `TOKEN_BUCKET_PEEK_SCRIPT`).

Zero duplicate Lua scripts are loaded into Redis.

### Argument Mapping
The `LeakyBucketConfig` parameters map directly to the Token Bucket script's `ARGV`:

| Script ARGV | Source Field in `LeakyBucketConfig` | Water Interpretation |
|---|---|---|
| `ARGV[1]` | `config.capacity` | Maximum bucket capacity |
| `ARGV[2]` | `config.a` | Leak rate numerator (internal units leaked per ms) |
| `ARGV[3]` | `config.b` | Leak rate denominator (internal units per 1 whole unit) |
| `ARGV[4]` | `config.capacityUnits` | Maximum room in internal units ($b \times \text{capacity}$) |
| `ARGV[5]` | `config.drainTimeMs` | Milliseconds to drain full bucket to empty |
| `ARGV[6]` | `cost` | Water units added by the incoming request |
| `ARGV[7]` | `nowMsOverride` | Optional test clock override (0 for server `TIME`) |

---

## Key Namespace Isolation

Even though the underlying Lua script is shared, keys in Redis are strictly partitioned by algorithm ID:
$$\text{key} = \text{reqnx}:\{\text{prefix}\}:\text{leaky-bucket}:\{\text{identity}\}$$

Token bucket state and leaky bucket state for the same identity reside in separate Redis keys and never conflict or overwrite each other.
