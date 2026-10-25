-- ──────────────────────────────────────────────────────────────────────────────
-- @reqnx/redis — Shared Lua: Validation
--
-- Safe integer validation for script inputs.
-- ──────────────────────────────────────────────────────────────────────────────

local function validate_safe_int(val, field_name)
  if not is_safe_integer(val) then
    return nil, 'REQNX_INVALID_ARGUMENT: ' .. field_name .. ' must be a safe integer'
  end
  return val, nil
end

local function validate_positive_int(val, field_name)
  if not is_safe_integer(val) or val < 1 then
    return nil, 'REQNX_INVALID_ARGUMENT: ' .. field_name .. ' must be a safe integer >= 1'
  end
  return val, nil
end
