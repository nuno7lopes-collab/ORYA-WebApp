-- KEYS:
-- 1 -> reserved counter key (hold:inventory:...:reserved)
-- 2 -> hold key prefix (hold:inventory:...:holds)
-- 3 -> hold index key (hold:inventory:index:{holdId})
--
-- ARGV:
-- 1 -> qty
-- 2 -> ttl_ms
-- 3 -> holdId
-- 4 -> holdJson
-- 5 -> maxStock

local qty = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local holdId = ARGV[3]
local holdJson = ARGV[4]
local maxStock = tonumber(ARGV[5])

if (not qty) or qty <= 0 then
  return cjson.encode({ ok = false, code = "INVALID_QUANTITY", available = 0 })
end
if (not maxStock) or maxStock <= 0 then
  return cjson.encode({ ok = false, code = "INVALID_MAX_STOCK", available = 0 })
end

local reserved = tonumber(redis.call("GET", KEYS[1]) or "0")
if (reserved + qty) > maxStock then
  return cjson.encode({ ok = false, code = "OUT_OF_STOCK", available = math.max(0, maxStock - reserved) })
end

local holdKey = KEYS[2] .. ":" .. holdId
if redis.call("EXISTS", holdKey) == 1 then
  return cjson.encode({ ok = false, code = "HOLD_EXISTS", available = math.max(0, maxStock - reserved) })
end

redis.call("INCRBY", KEYS[1], qty)
redis.call("SET", holdKey, holdJson, "PX", ttl)
if KEYS[3] and KEYS[3] ~= "" then
  redis.call("SET", KEYS[3], holdJson, "PX", ttl)
end

local currentTtl = redis.call("PTTL", KEYS[1])
if currentTtl < 0 then
  redis.call("PEXPIRE", KEYS[1], ttl)
end

return cjson.encode({ ok = true, reserved = reserved + qty, available = math.max(0, maxStock - (reserved + qty)) })

