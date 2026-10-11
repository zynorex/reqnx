# Day 6 Redis Port Specification: Fixed Window Counter

This specification details the Redis Lua script port of the `@reqnx/core` `fixedWindow` algorithm scheduled for Day 6. This document defines the exact key schema, state encoding, integer arithmetic rules, TTL semantics, return values, and test fixtures so the implementation is completely mechanical.

---

## 1. Storage Encoding

### Redis Data Structure

- Single Redis `Hash` per rate limiter key.
- Key format: `reqnx:{prefix}:fixed-window:{identity}`

### Hash Fields

| Field Name | Type             | Value Description                                                             |
| ---------- | ---------------- | ----------------------------------------------------------------------------- |
| `v`        | string (integer) | State schema version. Must be `"1"`.                                          |
| `ws`       | string (integer) | `windowStart`: Unix epoch timestamp in milliseconds of current window origin. |
| `c`        | string (integer) | `count`: Accumulated admitted cost in current window.                         |

---

## 2. Lua Script Arguments & Keys

### `KEYS`

- `KEYS[1]`: The full storage key (`reqnx:{prefix}:fixed-window:{identity}`).

### `ARGV`

| Argument  | Type    | Description                                                                                                                           |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ARGV[1]` | integer | `limit`: Configured maximum capacity (safe integer $\le 2^{31}-1$).                                                                   |
| `ARGV[2]` | integer | `windowMs`: Configured window duration in milliseconds.                                                                               |
| `ARGV[3]` | integer | `cost`: Requested consumption cost ($\ge 1$).                                                                                         |
| `ARGV[4]` | integer | `nowMsOverride` (optional): If $> 0$, use this timestamp instead of `redis.call('TIME')`. Enables deterministic differential testing. |

---

## 3. Time Source & Integer Arithmetic

1. **Timestamp Resolution**:
   ```lua
   local nowMs = tonumber(ARGV[4])
   if not nowMs or nowMs <= 0 then
     local time = redis.call('TIME')
     -- time[1] is seconds, time[2] is microseconds
     nowMs = math.floor(time[1] * 1000 + time[2] / 1000)
   end
   ```
2. **Double-Precision Float Safety**:
   - Lua numbers in Redis 5.x/6.x/7.x are standard IEEE 754 64-bit double-precision floats.
   - Max safe integer in Lua doubles is $2^{53} - 1 \approx 9.007 \times 10^{15}$.
   - Epoch milliseconds ($~1.7 \times 10^{12}$) and counts ($\le 2^{31}-1$) remain well below $2^{53}$, avoiding any float truncation.
   - Integer division is computed via `math.floor(a / b)`.

---

## 4. Execution Logic (Strictly Matching Core Step)

```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

-- 1. Compute aligned window start
local currentWindowStart = math.floor(nowMs / windowMs) * windowMs

-- 2. Read existing state
local raw = redis.call('HMGET', key, 'v', 'ws', 'c')
local version = raw[1]
local storedWs = tonumber(raw[2])
local storedCount = tonumber(raw[3])

local windowStart = currentWindowStart
local count = 0

if version == "1" and storedWs and storedCount then
  if storedWs == currentWindowStart then
    -- Same window
    windowStart = currentWindowStart
    count = storedCount
  elseif currentWindowStart < storedWs then
    -- Backwards clock: clamp to stored window
    windowStart = storedWs
    count = storedCount
  else
    -- Time advanced: fresh window
    windowStart = currentWindowStart
    count = 0
  end
end

-- 3. Evaluate admission (no INCR-then-compare; only admit if within budget)
local allowed = (count + cost) <= limit
local nextCount = count
if allowed then
  nextCount = count + cost
end

local remaining = limit - nextCount
local windowEnd = windowStart + windowMs
local retryAfterMs = 0
if not allowed then
  retryAfterMs = math.max(1, windowEnd - nowMs)
end

-- 4. Persist updated state and set TTL
if allowed or (not storedWs) then
  redis.call('HMSET', key, 'v', 1, 'ws', windowStart, 'c', nextCount)
  -- PEXPIREAT ensures the key expires exactly at or after windowEnd
  redis.call('PEXPIREAT', key, windowEnd)
end

-- 5. Return array representation matching Decision
return {
  allowed and 1 or 0, -- [1] allowed (1 or 0)
  limit,              -- [2] limit
  remaining,          -- [3] remaining
  windowEnd,          -- [4] resetAtMs
  retryAfterMs        -- [5] retryAfterMs
}
```

---

## 5. TTL Policy & Invariant

- Every write uses `PEXPIREAT key windowEnd`.
- Satisfies the **TTL Invariant**:
  1. State written at any time $t \in [\text{windowStart}, \text{windowEnd})$ remains alive until at least $\text{windowEnd}$.
  2. State naturally expires at $\text{windowEnd}$, bounding Redis memory cardinality.

---

## 6. Seed Cases for Differential Testing (Day 6)

During Day 6 implementation, differential testing will feed identical sequences to TypeScript `fixedWindow.step()` and the Redis Lua script, asserting exact matching outcomes:

| Test Seed                | Parameters                     | Expected Sequence                                                                                                                                                |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Golden Countdown**     | limit 3, window 1000ms, cost 1 | t=0: allowed, rem=2; t=10: allowed, rem=1; t=20: allowed, rem=0; t=30: denied, rem=0, retryAfter=970; t=999: denied, rem=0, retryAfter=1; t=1000: allowed, rem=2 |
| **Rollover**             | limit 2, window 1000ms         | t=999: denied, retryAfter=1; t=1000: allowed, rem=1                                                                                                              |
| **No-Consume Rejection** | limit 5, window 1000ms         | t=0: cost 3 (allowed); t=1: cost 3 (denied, rem=2); t=2: cost 2 (allowed, rem=0)                                                                                 |
| **Backwards Clock**      | limit 3, window 1000ms         | t=1200: cost 1 (ws=1000, c=1); t=500: cost 1 (ws=1000, c=2, resetAt=2000)                                                                                        |
