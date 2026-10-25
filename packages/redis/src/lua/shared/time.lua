-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Shared Lua: Time Resolution
--
-- Resolves epoch timestamp in milliseconds from ARGV or server TIME command.
-- ──────────────────────────────────────────────────────────────────────────────

local function resolve_now_ms(now_ms_arg)
  local passed = tonumber(now_ms_arg)
  if passed and passed > 0 then
    return passed, nil
  end
  local ok, t = pcall(redis.call, 'TIME')
  if not ok then
    return nil, 'REQNX_TIME_REJECTED: server rejected redis.call("TIME") inside Lua script'
  end
  local sec = tonumber(t[1])
  local usec = tonumber(t[2])
  local now_ms = sec * 1000 + math.floor(usec / 1000)
  return now_ms, nil
end
