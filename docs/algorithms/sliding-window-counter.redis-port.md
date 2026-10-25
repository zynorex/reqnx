# Redis Port Specification: Sliding Window Counter

## 1. Overview & Key Schema

- **Algorithm ID**: `sliding-window-counter`
- **Key Schema**: `reqnx:{prefix}:sliding-window-counter:{identity}`
- **Data Structure**: Redis Hash (`HASH`)
  - `v`: `1` (version)
  - `ws`: `currentWindowStart`
  - `cc`: `currentCount`
  - `pc`: `previousCount`
- **TTL**: $2 \times \text{windowMs}$ milliseconds (`PEXPIREAT key currentWindowStart + 2 * windowMs`). Denied requests never write and never touch TTL.

## 2. Arguments Contract

- `KEYS[1]`: Storage key
- `ARGV[1]`: `limit` (integer $\ge 1$)
- `ARGV[2]`: `windowMs` (integer $\ge 1$)
- `ARGV[3]`: `cost` (integer $\ge 1$, ignored if `IS_PEEK`)
- `ARGV[4]`: `nowMsOverride` (0 if using server `TIME`)

## 3. Algorithm Execution Logic

1. Resolve `nowMs` via `resolve_now_ms`.
2. Compute `currentWindowStart = div_floor(nowMs, windowMs) * windowMs`.
3. Fetch existing state: `redis.call('HMGET', key, 'v', 'ws', 'cc', 'pc')`.
4. Validate version & safe integer corruption: if `v == "1"`, ensure fields are non-negative safe integers.
5. Resolve current and previous counts across window transitions:
   - Same window: carry `currentCount` and `previousCount`.
   - Advanced by 1 window: `previousCount = storedCc; currentCount = 0`.
   - Advanced by $\ge 2$ windows: `previousCount = 0; currentCount = 0`.
   - Backwards clock: clamp to stored `currentWindowStart`.
6. Calculate estimated count:
   - `elapsed = math.min(effectiveNow - currentWindowStart, windowMs)`
   - `scaledPrevious = div_floor(previousCount * (windowMs - elapsed), windowMs)`
   - `estimatedCount = scaledPrevious + currentCount`
7. Evaluate admission:
   - If `allowed`:
     - `redis.call('HSET', key, 'v', 1, 'ws', currentWindowStart, 'cc', currentCount + cost, 'pc', previousCount)`
     - `redis.call('PEXPIREAT', key, currentWindowStart + 2 * windowMs)`
   - If `not allowed`:
     - Zero writes!
8. Return `[allowed, limit, remaining, windowEnd, retryAfterMs]`.
