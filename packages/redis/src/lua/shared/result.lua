-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Shared Lua: Decision Formatting
--
-- Standard array format matching Decision tuple [allowed, limit, remaining, resetAtMs, retryAfterMs].
-- ──────────────────────────────────────────────────────────────────────────────

local function format_decision(allowed, limit, remaining, reset_at_ms, retry_after_ms)
  return {
    allowed and 1 or 0,
    limit,
    remaining,
    reset_at_ms,
    retry_after_ms
  }
end
