-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Shared Lua: Exact Math
--
-- Safe integer boundary constants and integer division with correction steps.
-- ──────────────────────────────────────────────────────────────────────────────

local MAX_SAFE_INT = 9007199254740991 -- 2^53 - 1
local MIN_SAFE_INT = -9007199254740991

local function is_safe_integer(val)
  return type(val) == "number" and val == math.floor(val) and val >= MIN_SAFE_INT and val <= MAX_SAFE_INT
end

local function div_floor(a, b)
  if b == 0 then return 0 end
  local q = math.floor(a / b)
  if (q + 1) * b <= a then
    q = q + 1
  elseif q * b > a then
    q = q - 1
  end
  return q
end

local function div_ceil(a, b)
  if b == 0 then return 0 end
  local q = math.ceil(a / b)
  if q * b < a then
    q = q + 1
  elseif (q - 1) * b >= a then
    q = q - 1
  end
  return q
end
