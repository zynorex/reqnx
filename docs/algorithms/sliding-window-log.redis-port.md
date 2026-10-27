# Redis Port Specification: Sliding Window Log

## 1. Overview & Key Schema

- **Algorithm ID**: `sliding-window-log`
- **Key Schema**: `reqnx:{prefix}:sliding-window-log:{identity}`
- **Data Structure**: Redis Sorted Set (`ZSET`)
  - **Score**: Millisecond timestamp (`nowMs`)
  - **Member**: `{timestampMs}:{cost}:{uniqueSeq}` (disambiguates multiple concurrent calls in the same millisecond)
- **TTL**: `windowMs` milliseconds (`PEXPIREAT key nowMs + windowMs`). Denied requests never write and never touch TTL.

## 2. Arguments Contract

- `KEYS[1]`: Storage key
- `ARGV[1]`: `limit` (integer $\ge 1$)
- `ARGV[2]`: `windowMs` (integer $\ge 1$)
- `ARGV[3]`: `cost` (integer $\ge 1$, ignored if `IS_PEEK`)
- `ARGV[4]`: `seq` (monotonically unique string/number tiebreaker)
- `ARGV[5]`: `nowMsOverride` (0 if using server `TIME`)

## 3. Algorithm Execution Logic

1. Resolve `nowMs` via `resolve_now_ms`.
2. Prune expired entries: `redis.call('ZREMRANGEBYSCORE', key, '-inf', nowMs - windowMs)`.
3. Fetch active entries: `redis.call('ZRANGE', key, 0, -1)`.
4. Parse member strings `{timestamp}:{cost}:{seq}` and calculate `currentCount`. If any member cannot be parsed, return `REQNX_CORRUPT_STATE`.
5. Monotonicity: `effectiveNow = math.max(nowMs, latestTimestamp)`.
6. Admission check:
   - If `IS_PEEK`: `allowed = currentCount + 1 <= limit`. Do not write.
   - Else: `allowed = currentCount + cost <= limit`.
     - If `allowed`:
       - `redis.call('ZADD', key, effectiveNow, member)`
       - `redis.call('PEXPIREAT', key, effectiveNow + windowMs)`
     - Else: Zero writes.
7. Return `[allowed, limit, remaining, resetAtMs, retryAfterMs]`.
