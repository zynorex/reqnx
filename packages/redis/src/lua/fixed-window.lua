-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Lua Port: Fixed Window Counter
--
-- Single body for consume and peek (IS_PEEK constant defined by runner).
-- ──────────────────────────────────────────────────────────────────────────────

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now_arg = ARGV[4]

-- 1. Resolve current timestamp
local nowMs, time_err = resolve_now_ms(now_arg)
if time_err then
  return redis.error_reply(time_err)
end

-- 2. Validate input arguments
if not is_safe_integer(limit) or limit < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: limit must be a safe integer >= 1')
end
if not is_safe_integer(windowMs) or windowMs < 1 then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: windowMs must be a safe integer >= 1')
end
if not IS_PEEK and (not is_safe_integer(cost) or cost < 1) then
  return redis.error_reply('REQNX_INVALID_ARGUMENT: cost must be a safe integer >= 1')
end

-- 3. Compute aligned window start
local currentWindowStart = div_floor(nowMs, windowMs) * windowMs

-- 4. Read existing state
local raw = redis.call('HMGET', key, 'v', 'ws', 'c')
local version = raw[1]
local rawWs = raw[2]
local rawCount = raw[3]

local windowStart = currentWindowStart
local count = 0

if version == "1" then
  local storedWs = tonumber(rawWs)
  local storedCount = tonumber(rawCount)

  if rawWs and not is_safe_integer(storedWs) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored windowStart is corrupt')
  end
  if rawCount and (not is_safe_integer(storedCount) or storedCount < 0) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored count is corrupt')
  end

  if storedWs and storedCount then
    if storedWs == currentWindowStart then
      -- Same window
      windowStart = currentWindowStart
      count = storedCount
    elseif currentWindowStart < storedWs then
      -- Backwards clock: clamp to stored window
      windowStart = storedWs
      count = storedCount
    else
      -- Time advanced past stored window: fresh window
      windowStart = currentWindowStart
      count = 0
    end
  end
end

-- 5. Evaluate admission
local windowEnd = windowStart + windowMs

if IS_PEEK then
  local allowed = (count + 1) <= limit
  local remaining = limit - count
  local retryAfterMs = allowed and 0 or math.max(1, windowEnd - nowMs)
  return format_decision(allowed, limit, remaining, windowEnd, retryAfterMs)
else
  local allowed = (count + cost) <= limit
  local nextCount = allowed and (count + cost) or count
  local remaining = limit - nextCount
  local retryAfterMs = allowed and 0 or math.max(1, windowEnd - nowMs)

  -- 6. Persist updated state ONLY if allowed
  -- Denied requests never write state and never touch TTL.
  if allowed then
    redis.call('HSET', key, 'v', 1, 'ws', windowStart, 'c', nextCount)
    redis.call('PEXPIREAT', key, windowEnd)
  end

  return format_decision(allowed, limit, remaining, windowEnd, retryAfterMs)
end
