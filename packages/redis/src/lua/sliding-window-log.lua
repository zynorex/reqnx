-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Lua Port: Sliding Window Log
--
-- Single body for consume and peek (IS_PEEK constant defined by runner).
-- ──────────────────────────────────────────────────────────────────────────────

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local seq = ARGV[4] or "0"
local now_arg = ARGV[5]

local function parse_member(m)
  local ts_str, cost_str = string.match(m, "^(%d+):(%d+):")
  if not ts_str or not cost_str then
    return nil, nil
  end
  return tonumber(ts_str), tonumber(cost_str)
end

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

-- 3. Read active entries without mutating key
local thresholdMs = nowMs - windowMs
local raw_entries = redis.call('ZRANGEBYSCORE', key, '(' .. thresholdMs, '+inf')

local currentCount = 0
local latestTimestamp = 0
local active_logs = {}

for i = 1, #raw_entries do
  local entry_ts, entry_cost = parse_member(raw_entries[i])
  if not entry_ts or not entry_cost then
    return redis.error_reply('REQNX_CORRUPT_STATE: corrupt member in sliding window log')
  end
  currentCount = currentCount + entry_cost
  if entry_ts > latestTimestamp then
    latestTimestamp = entry_ts
  end
  active_logs[#active_logs + 1] = { ts = entry_ts, cost = entry_cost }
end

local effectiveNow = math.max(nowMs, latestTimestamp)

-- 4. Evaluate admission
if IS_PEEK then
  local allowed = (currentCount + 1) <= limit
  local remaining = limit - currentCount
  local newestTs = #active_logs > 0 and active_logs[#active_logs].ts or effectiveNow
  local resetAtMs = newestTs + windowMs
  local retryAfterMs = 0

  if not allowed then
    local neededToDrop = currentCount + 1 - limit
    local accumulated = 0
    local dropTargetTime = effectiveNow + windowMs
    for i = 1, #active_logs do
      accumulated = accumulated + active_logs[i].cost
      if accumulated >= neededToDrop then
        dropTargetTime = active_logs[i].ts + windowMs
        break
      end
    end
    retryAfterMs = math.max(1, dropTargetTime - nowMs)
  end

  return format_decision(allowed, limit, remaining, resetAtMs, retryAfterMs)
else
  local allowed = (currentCount + cost) <= limit
  local nextCount = allowed and (currentCount + cost) or currentCount
  local remaining = limit - nextCount
  local newestTs = allowed and effectiveNow or (#active_logs > 0 and active_logs[#active_logs].ts or effectiveNow)
  local resetAtMs = newestTs + windowMs
  local retryAfterMs = 0

  if not allowed then
    if cost > limit then
      retryAfterMs = windowMs
    else
      local neededToDrop = currentCount + cost - limit
      local accumulated = 0
      local dropTargetTime = effectiveNow + windowMs
      for i = 1, #active_logs do
        accumulated = accumulated + active_logs[i].cost
        if accumulated >= neededToDrop then
          dropTargetTime = active_logs[i].ts + windowMs
          break
        end
      end
      retryAfterMs = math.max(1, dropTargetTime - nowMs)
    end
  else
    -- 5. Allowed: prune expired and write new entry
    redis.call('ZREMRANGEBYSCORE', key, '-inf', thresholdMs)
    local member = effectiveNow .. ':' .. cost .. ':' .. tostring(seq)
    redis.call('ZADD', key, effectiveNow, member)
    redis.call('PEXPIREAT', key, effectiveNow + windowMs)
  end

  return format_decision(allowed, limit, remaining, resetAtMs, retryAfterMs)
end
