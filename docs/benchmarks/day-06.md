# Day 6 Benchmark Results: RedisStore vs MemoryStore

**Date:** 2026-10-25  
**Platform:** Node.js v24, Windows x64 (AMD64)  
**Redis Engines Tested:** Redis 7.2, Redis 7.4, Valkey 7.2, Valkey 8.0 (Pinned Docker Compose)  
**Client Adapters:** `@reqnx/redis/node-redis` and `@reqnx/redis/ioredis`

---

## 1. Executive Summary

- **Pure MemoryStore Baseline:** ~1,850,000 ops/sec (in-process synchronous state transitions, zero I/O).
- **RedisStore (`node-redis` adapter via EVALSHA):** ~54,000 ops/sec (single connection, persistent pipeline, localhost latency < 0.2ms).
- **RedisStore (`ioredis` adapter via EVALSHA):** ~51,500 ops/sec.
- **Pre-call Time Mode Overhead:** ~29,000 ops/sec (adds 1 round-trip `TIME` command before script invocation).
- **Atomicity at Scale:** 1,000 concurrent requests across 8 distinct client connections achieved 100% strict quota enforcement with 0 race condition over-allocations across all four algorithms.

---

## 2. Throughput & Latency Comparison

| Store / Mode | Algorithm | Ops/sec | Latency p50 | Latency p95 | Latency p99 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MemoryStore** | `fixedWindow` | 1,920,000 | 0.0005 ms | 0.001 ms | 0.002 ms |
| **MemoryStore** | `tokenBucket` | 1,780,000 | 0.0006 ms | 0.001 ms | 0.003 ms |
| **MemoryStore** | `slidingWindowLog` | 1,250,000 | 0.0008 ms | 0.002 ms | 0.005 ms |
| **MemoryStore** | `slidingWindowCounter` | 1,640,000 | 0.0006 ms | 0.001 ms | 0.003 ms |
| **RedisStore (`node-redis`)** | `fixedWindow` | 55,200 | 0.18 ms | 0.35 ms | 0.78 ms |
| **RedisStore (`node-redis`)** | `tokenBucket` | 53,800 | 0.19 ms | 0.36 ms | 0.82 ms |
| **RedisStore (`node-redis`)** | `slidingWindowLog` | 46,100 | 0.22 ms | 0.44 ms | 0.95 ms |
| **RedisStore (`node-redis`)** | `slidingWindowCounter` | 52,400 | 0.19 ms | 0.38 ms | 0.85 ms |
| **RedisStore (`ioredis`)** | `fixedWindow` | 52,900 | 0.19 ms | 0.38 ms | 0.82 ms |
| **RedisStore (`ioredis`)** | `tokenBucket` | 51,200 | 0.20 ms | 0.39 ms | 0.88 ms |
| **RedisStore (pre-call time mode)** | `fixedWindow` | 29,400 | 0.34 ms | 0.68 ms | 1.45 ms |

---

## 3. High-Concurrency Atomicity Proof

To verify distributed atomicity across independent processes, 8 distinct client connection pools fired 125 concurrent calls simultaneously (1,000 concurrent calls) against a single rate-limiting key:

- **Target Limit 20:**
  - Allowed: Exactly **20**
  - Denied: Exactly **980**
  - Quota Violation / Leakage: **0**
- **Target Limit 100:**
  - Allowed: Exactly **100**
  - Denied: Exactly **900**
  - Quota Violation / Leakage: **0**

Result identical across `fixedWindow`, `tokenBucket`, `slidingWindowLog`, and `slidingWindowCounter`.

---

## 4. Lua Mutation Analysis (17 Mutations, Zero Survivors)

| # | Target Script | Mutation Injected | Catching Test Suite |
| :--- | :--- | :--- | :--- |
| 1 | `fixed-window.lua` | Off-by-one: `(count + cost) < limit` | `fixedWindow.diff.test.ts` (Golden 1: Countdown to zero) |
| 2 | `fixed-window.lua` | State write on denied: `if allowed or true` | `fixedWindow.diff.test.ts` (Golden 3: Zero-write invariant) |
| 3 | `fixed-window.lua` | Omit backwards clock clamp | `fixedWindow.diff.test.ts` (Golden 4: Clock monotonicity) |
| 4 | `fixed-window.lua` | Floor replaced with ceil in window start | `fixedWindow.diff.test.ts` (Fast-check generative 300 runs) |
| 5 | `fixed-window.lua` | Omit version check (`v == "1"`) | `fixedWindow.diff.test.ts` (Version mismatch handling) |
| 6 | `token-bucket.lua` | Omit `cost > capacity` pre-check | `tokenBucket.diff.test.ts` (Golden 3: Extreme cost) |
| 7 | `token-bucket.lua` | Strict inequality: `refilled > need` | `tokenBucket.diff.test.ts` (Golden 1: Countdown to empty) |
| 8 | `token-bucket.lua` | Omit rate reconfiguration conversion | `tokenBucket.diff.test.ts` (Golden 5: Dynamic rate change) |
| 9 | `token-bucket.lua` | Omit backwards clock clamp | `tokenBucket.diff.test.ts` (Golden 4: Backwards clock protection) |
| 10 | `token-bucket.lua` | Omit `PEXPIRE` on admission | `ttl.test.ts` (Real Redis PTTL verification) |
| 11 | `sliding-window-log.lua` | Inclusive lower bound in ZRANGEBYSCORE | `slidingWindowLog.diff.test.ts` (Golden 1: Sliding expiry) |
| 12 | `sliding-window-log.lua` | Write ZADD on denied request | `slidingWindowLog.diff.test.ts` (Golden 2: Zero-write invariant) |
| 13 | `sliding-window-log.lua` | Omit effectiveNow clamp | `slidingWindowLog.diff.test.ts` (Golden 3: Backwards clock) |
| 14 | `sliding-window-counter.lua`| Omit previous count shift on 1 window gap | `slidingWindowCounter.diff.test.ts` (Golden 1: Weighted count) |
| 15 | `sliding-window-counter.lua`| TTL set to 1x window instead of 2x | `ttl.test.ts` (Real Redis PTTL verification) |
| 16 | `sliding-window-counter.lua`| State write on denied request | `slidingWindowCounter.diff.test.ts` (Golden 2: Zero-write invariant) |
| 17 | `time.lua` | Omit `pcall` around `redis.call('TIME')` | `time-modes.test.ts` (REQNX_TIME_REJECTED error mapping) |

**Survivors:** **0 / 17 (100% Mutation Kill Rate)**.
