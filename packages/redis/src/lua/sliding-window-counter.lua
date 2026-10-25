-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Lua Port: Sliding Window Counter
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
local raw = redis.call('HMGET', key, 'v', 'ws', 'cc', 'pc')
local version = raw[1]
local rawWs = raw[2]
local rawCc = raw[3]
local rawPc = raw[4]

local windowStart = currentWindowStart
local currentCount = 0
local previousCount = 0

if version == "1" then
  local storedWs = tonumber(rawWs)
  local storedCc = tonumber(rawCc)
  local storedPc = tonumber(rawPc)

  if rawWs and not is_safe_integer(storedWs) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored windowStart is corrupt')
  end
  if rawCc and (not is_safe_integer(storedCc) or storedCc < 0) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored currentCount is corrupt')
  end
  if rawPc and (not is_safe_integer(storedPc) or storedPc < 0) then
    return redis.error_reply('REQNX_CORRUPT_STATE: stored previousCount is corrupt')
  end

  if storedWs and storedCc and storedPc then
    if storedWs == currentWindowStart then
      -- Same window
      windowStart = currentWindowStart
      currentCount = storedCc
      previousCount = storedPc
    elseif currentWindowStart < storedWs then
      -- Backwards clock
      windowStart = storedWs
      currentCount = storedCc
      previousCount = storedPc
    elseif currentWindowStart == storedWs + windowMs then
      -- Advanced by 1 window: current becomes previous
      windowStart = currentWindowStart
      currentCount = 0
      previousCount = storedCc
    else
      -- Advanced by >= 2 windows: both expired
      windowStart = currentWindowStart
      currentCount = 0
      previousCount = 0
    end
  end
end

-- 5. Calculate estimated count
local effectiveNow = math.max(nowMs, windowStart)
local rawElapsed = effectiveNow - windowStart
local elapsed = math.min(rawElapsed, windowMs)

local scaledPrevious = div_floor(previousCount * (windowMs - elapsed), windowMs)
local estimatedCount = scaledPrevious + currentCount
local windowEnd = windowStart + windowMs

-- 6. Evaluate admission
if IS_PEEK then
  local allowed = (estimatedCount + 1) <= limit
  local remaining = limit - estimatedCount
  local retryAfterMs = 0

  if not allowed then
    local K = limit - currentCount - 1
    if K < 0 or previousCount <= 0 then
      retryAfterMs = math.max(1, windowEnd - nowMs)
    else
      local neededElapsed = windowMs - div_floor(K * windowMs, previousCount)
      local dropTargetTime = windowStart + neededElapsed
      retryAfterMs = math.max(1, dropTargetTime - nowMs)
    end
  end

  return format_decision(allowed, limit, remaining, windowEnd, retryAfterMs)
else
  local allowed = (estimatedCount + cost) <= limit
  local nextCurrentCount = allowed and (currentCount + cost) or currentCount
  local nextEstimatedCount = allowed and (estimatedCount + cost) or estimatedCount
  local remaining = limit - nextEstimatedCount
  local retryAfterMs = 0

  if not allowed then
    if cost > limit then
      retryAfterMs = windowMs
    else
      local K = limit - currentCount - cost
      if K < 0 or previousCount <= 0 then
        retryAfterMs = math.max(1, windowEnd - nowMs)
      else
        local neededElapsed = windowMs - div_floor(K * windowMs, previousCount)
        local dropTargetTime = windowStart + neededElapsed
        retryAfterMs = math.max(1, dropTargetTime - nowMs)
      end
    end
  else
    -- 7. Persist only if allowed (TTL is 2 * windowMs)
    -- Denied requests never write state and never touch TTL.
    redis.call('HSET', key, 'v', 1, 'ws', windowStart, 'cc', nextCurrentCount, 'pc', previousCount)
    redis.call('PEXPIREAT', key, windowStart + 2 * windowMs)
  end

  return format_decision(allowed, limit, remaining, windowEnd, retryAfterMs)
end
