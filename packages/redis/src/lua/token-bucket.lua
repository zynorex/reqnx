-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Lua Port: Token Bucket
--
-- Single body for consume and peek (IS_PEEK constant defined by runner).
-- ──────────────────────────────────────────────────────────────────────────────

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local a = tonumber(ARGV[2])
local b = tonumber(ARGV[3])
local capacityUnits = tonumber(ARGV[4])
local fullRefillMs = tonumber(ARGV[5])
local cost = tonumber(ARGV[6])
local now_arg = ARGV[7]

-- 1. Resolve current timestamp
local nowMs, time_err = resolve_now_ms(now_arg)
if time_err then
  return redis.error_reply(time_err)
end

-- 2. Validate input arguments
if not is_safe_integer(capacity) or capacity < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: capacity must be a safe integer >= 1')
end
if not is_safe_integer(a) or a < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: a must be a safe integer >= 1')
end
if not is_safe_integer(b) or b < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: b must be a safe integer >= 1')
end
if not is_safe_integer(capacityUnits) or capacityUnits < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: capacityUnits must be a safe integer >= 1')
end
if not is_safe_integer(fullRefillMs) or fullRefillMs < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: fullRefillMs must be a safe integer >= 1')
end
if not IS_PEEK and (not is_safe_integer(cost) or cost < 1) then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: cost must be a safe integer >= 1')
end

-- 3. Read existing state
local raw = redis.call('HMGET', key, 'v', 'l', 'at', 'a', 'b')
local version = raw[1]
local rawLevel = raw[2]
local rawAt = raw[3]
local rawA = raw[4]
local rawB = raw[5]

local effectiveNow = nowMs
local refilled = capacityUnits

if version == "1" then
  local storedLevel = tonumber(rawLevel)
  local storedAt = tonumber(rawAt)
  local storedA = tonumber(rawA)
  local storedB = tonumber(rawB)

  if rawLevel and (not is_safe_integer(storedLevel) or storedLevel < 0) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored level is corrupt')
  end
  if rawAt and (not is_safe_integer(storedAt) or storedAt < 0) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored at timestamp is corrupt')
  end
  if rawA and (not is_safe_integer(storedA) or storedA < 1) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored rate numerator a is corrupt')
  end
  if rawB and (not is_safe_integer(storedB) or storedB < 1) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored rate denominator b is corrupt')
  end

  if storedLevel and storedAt and storedA and storedB then
    -- Backwards clock protection: never let reference instant move backwards
    effectiveNow = math.max(nowMs, storedAt)
    local elapsed = effectiveNow - storedAt

    local level = storedLevel
    if storedA ~= a or storedB ~= b then
      -- Rate changed: convert whole tokens conservatively
      local wholeTokens = math.min(div_floor(storedLevel, storedB), capacity)
      level = wholeTokens * b
    end

    local clampedElapsed = math.min(elapsed, fullRefillMs)
    refilled = math.min(capacityUnits, level + clampedElapsed * a)
  end
end

-- 4. Evaluate admission
if IS_PEEK then
  local need = b -- 1 token
  local allowed = refilled >= need
  local levelAfter = refilled
  local remaining = div_floor(levelAfter, b)
  local resetAtMs = effectiveNow + div_ceil(capacityUnits - levelAfter, a)
  local retryAfterMs = allowed and 0 or ((effectiveNow + div_ceil(need - refilled, a)) - nowMs)

  return format_decision(allowed, capacity, remaining, resetAtMs, retryAfterMs)
else
  -- Check if cost > capacity before multiplication to prevent overflow
  if cost > capacity then
    local levelAfter = refilled
    local remaining = div_floor(levelAfter, b)
    local unitsToFull = capacityUnits - levelAfter
    local msToFull = unitsToFull > 0 and div_ceil(unitsToFull, a) or fullRefillMs
    local resetAtMs = effectiveNow + div_ceil(unitsToFull, a)
    local retryAfterMs = (effectiveNow + msToFull) - nowMs

    -- Denied requests do not write
    return format_decision(false, capacity, remaining, resetAtMs, retryAfterMs)
  end

  local need = cost * b
  local allowed = refilled >= need
  local levelAfter = allowed and (refilled - need) or refilled
  local remaining = div_floor(levelAfter, b)
  local resetAtMs = effectiveNow + div_ceil(capacityUnits - levelAfter, a)
  local retryAfterMs = allowed and 0 or ((effectiveNow + div_ceil(need - refilled, a)) - nowMs)

  -- 5. Persist only if allowed
  -- Denied requests never write state and never touch TTL.
  if allowed then
    redis.call('HSET', key, 'v', 1, 'l', levelAfter, 'at', effectiveNow, 'a', a, 'b', b)
    redis.call('PEXPIRE', key, fullRefillMs)
  end

  return format_decision(allowed, capacity, remaining, resetAtMs, retryAfterMs)
end
