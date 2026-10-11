# Day 6 Redis Port Specification: Token Bucket

This specification details the Redis Lua script port of the `@reqnx/core` `tokenBucket` algorithm scheduled for Day 6. This document defines the exact key schema, state encoding, integer arithmetic rules, TTL semantics, return values, and test fixtures so the implementation is completely mechanical.

---

## 1. Storage Encoding

### Redis Data Structure

- Single Redis `Hash` per rate limiter key.
- Key format: `reqnx:{prefix}:token-bucket:{identity}`

### Hash Fields

| Field Name | Type             | Value Description                                                                               |
| ---------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `v`        | string (integer) | State schema version. Must be `"1"`.                                                            |
| `l`        | string (integer) | `level`: Current token level in internal units ($0 \le \text{level} \le \text{capacityUnits}$). |
| `at`       | string (integer) | Epoch millisecond timestamp when `level` was last updated / admitted.                           |
| `a`        | string (integer) | Normalised rate numerator under which this state was written.                                   |
| `b`        | string (integer) | Normalised rate denominator under which this state was written.                                 |

---

## 2. Lua Script Arguments & Keys

Pre-normalisation is performed in TypeScript by `parseConfig()`. All rate reduction ($g = \gcd(\text{refillTokens}, \text{intervalMs})$), `capacityUnits`, and `fullRefillMs` arrive as pre-computed safe integers, keeping the Lua script minimal and arithmetic-only.

### `KEYS`

- `KEYS[1]`: The full storage key (`reqnx:{prefix}:token-bucket:{identity}`).

### `ARGV`

| Argument  | Type    | Description                                                                                                                           |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ARGV[1]` | integer | `capacity`: Configured maximum burst capacity ($\le 2^{31}-1$).                                                                       |
| `ARGV[2]` | integer | `a`: Normalised rate numerator ($\le 2^{31}-1$).                                                                                      |
| `ARGV[3]` | integer | `b`: Normalised rate denominator ($1 \text{ token} = b \text{ units}$).                                                               |
| `ARGV[4]` | integer | `capacityUnits`: Pre-computed $\text{capacity} \times b$ ($\le 2^{51}$).                                                              |
| `ARGV[5]` | integer | `fullRefillMs`: Pre-computed $\lceil \frac{\text{capacityUnits}}{a} \rceil$.                                                          |
| `ARGV[6]` | integer | `cost`: Requested consumption cost ($\ge 1$).                                                                                         |
| `ARGV[7]` | integer | `nowMsOverride` (optional): If $> 0$, use this timestamp instead of `redis.call('TIME')`. Enables deterministic differential testing. |

---

## 3. Time Source & Integer Arithmetic

1. **Timestamp Resolution**:

   ```lua
   local nowMs = tonumber(ARGV[7])
   if not nowMs or nowMs <= 0 then
     local time = redis.call('TIME')
     -- time[1] is seconds, time[2] is microseconds
     nowMs = math.floor(time[1] * 1000 + time[2] / 1000)
   end
   ```

2. **Precision Proof in Lua Doubles ($2^{53} - 1$)**:
   - Numbers in Redis Lua (5.1) are IEEE 754 64-bit double-precision floats.
   - Max safe integer without precision loss: $2^{53} - 1 = 9,007,199,254,740,991$.
   - By config validation in TypeScript: $\text{capacityUnits} \le 2^{51} = 2,251,799,813,685,248$.
   - Refill addition: $\text{level} + \min(\text{elapsed}, \text{fullRefillMs}) \times a \le 2 \times \text{capacityUnits} + a$.
   - Maximum possible intermediate:
     $$2 \times 2^{51} + (2^{31} - 1) = 2^{52} + 2,147,483,647 \approx 4.505 \times 10^{15} \ll 2^{53} - 1$$
   - Therefore, integer calculations in Lua double precision are **strictly exact** with zero precision loss.

3. **Ceil and Floor Integer Division**:
   - Floor: `math.floor(x / y)`
   - Ceil: `math.ceil(x / y)` (exact for all safe integers).

---

## 4. Execution Logic (Strictly Matching Core Step)

```lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local a = tonumber(ARGV[2])
local b = tonumber(ARGV[3])
local capacityUnits = tonumber(ARGV[4])
local fullRefillMs = tonumber(ARGV[5])
local cost = tonumber(ARGV[6])

-- 1. Read existing state
local raw = redis.call('HMGET', key, 'v', 'l', 'at', 'a', 'b')
local version = raw[1]
local storedLevel = tonumber(raw[2])
local storedAt = tonumber(raw[3])
local storedA = tonumber(raw[4])
local storedB = tonumber(raw[5])

local effectiveNow = nowMs
local refilled = capacityUnits

if version == "1" and storedLevel and storedAt and storedA and storedB then
  effectiveNow = math.max(nowMs, storedAt)
  local elapsed = effectiveNow - storedAt

  local level = storedLevel
  if storedA ~= a or storedB ~= b then
    -- Rate changed: convert whole tokens conservatively
    local wholeTokens = math.min(math.floor(storedLevel / storedB), capacity)
    level = wholeTokens * b
  end

  local clampedElapsed = math.min(elapsed, fullRefillMs)
  refilled = math.min(capacityUnits, level + clampedElapsed * a)
end

-- 2. Check cost > capacity before multiplication
if cost > capacity then
  local remaining = math.floor(refilled / b)
  local unitsToFull = capacityUnits - refilled
  local msToFull = unitsToFull > 0 and math.ceil(unitsToFull / a) or fullRefillMs
  local resetAtMs = effectiveNow + math.ceil(unitsToFull / a)
  local retryAfterMs = (effectiveNow + msToFull) - nowMs

  -- Denied requests do not write
  return { 0, capacity, remaining, resetAtMs, retryAfterMs }
end

-- 3. Evaluate admission
local need = cost * b
local allowed = refilled >= need
local levelAfter = allowed and (refilled - need) or refilled
local remaining = math.floor(levelAfter / b)
local resetAtMs = effectiveNow + math.ceil((capacityUnits - levelAfter) / a)
local retryAfterMs = 0

if not allowed then
  retryAfterMs = (effectiveNow + math.ceil((need - refilled) / a)) - nowMs
end

-- 4. Persist only if allowed
if allowed then
  redis.call('HMSET', key, 'v', 1, 'l', levelAfter, 'at', effectiveNow, 'a', a, 'b', b)
  -- PEXPIRE resets TTL on each admission to fullRefillMs
  redis.call('PEXPIRE', key, fullRefillMs)
end

-- 5. Return array representation matching Decision
return {
  allowed and 1 or 0, -- [1] allowed
  capacity,           -- [2] limit
  remaining,          -- [3] remaining
  resetAtMs,          -- [4] resetAtMs
  retryAfterMs        -- [5] retryAfterMs
}
```

---

## 5. TTL Policy & Invariant

- Storage TTL is enforced via `redis.call('PEXPIRE', key, fullRefillMs)`.
- **Denied requests never write and never extend TTL.**
- **Admitted requests refresh TTL to `fullRefillMs`.**
- **TTL Invariant**: An entry expires only when the bucket has been idle for at least `fullRefillMs`, at which point it is completely full anyway. Eviction is behaviour-preserving and never grants extra capacity.

---

## 6. Seed Cases for Differential Testing (Day 6)

During Day 6 implementation, differential testing will feed identical sequences to TypeScript `tokenBucket.step()` and the Redis Lua script:

| Test Seed           | Parameters                  | Expected Sequence                                                                                                                                                                               |
| ------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Golden Config A** | cap 5, 1 tok / 1000ms       | t=0: five cost 1 allowed (rem: 4, 3, 2, 1, 0, resetAt: 1000..5000); t=0: 6th denied (rem 0, retryAfter 1000); t=500: denied (retryAfter 500); t=1000: allowed (rem 0); t=11000: allowed (rem 4) |
| **Golden Config B** | cap 3, 3 tok / 1000ms       | t=0: cost 3 allowed; t=0: cost 1 denied (retryAfter 334); t=333: denied (retryAfter 1); t=334: allowed (rem 0, resetAt 1334); t=667: allowed; t=1000: allowed                                   |
| **Golden Config C** | cap 10, 10 tok / 1000ms     | t=0: cost 4 allowed (rem 6, resetAt 400); t=0: cost 7 denied (retryAfter 100); t=100: cost 7 allowed (rem 0, resetAt 1100)                                                                      |
| **Backwards Clock** | stored at=10000, level=2000 | t=9000 cost 1 allowed (rem 1, resetAt 14000); t=9000 cost 3 denied (rem 2, retryAfter 2000)                                                                                                     |
| **Extreme Cost**    | cap 5, cost MAX_SAFE_INT    | t=0: denied (limit 5, rem 5, retryAfter 5000, zero state change)                                                                                                                                |
