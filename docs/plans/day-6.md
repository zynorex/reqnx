# Day 6 Plan: RedisStore and the Lua Ports of the Four Algorithms

**Branch:** `day-6-redis`  
**Status:** Approved & In Progress  
**Objective:** Deliver `@reqnx/redis` with `RedisStore` and Lua ports of the rate-limiting algorithms, proven equivalent to the pure TypeScript versions by differential tests.

---

## 1. Context & Scope

- **Delivered today:** `packages/redis` with:
  - Minimal structural client adapter interface (`RedisClientAdapter`) with zero runtime dependencies
  - Dual adapters behind subpath exports (`@reqnx/redis/node-redis` and `@reqnx/redis/ioredis`) as optional peer dependencies
  - Self-healing script runner (`EVALSHA` with local SHA1 calculation and fallback to `EVAL` on `NOSCRIPT`, script warmup, and execution stats)
  - Lua toolchain: single-body source files under `packages/redis/src/lua`, automated concatenation into `src/scripts/generated.ts`, and a strict freshness test
  - Shared exact integer arithmetic helpers in Lua preventing precision loss across safe integer bounds ($2^{53}-1$)
  - Lua ports of the rate-limiting algorithms (`fixedWindow`, `tokenBucket`, `slidingWindowLog`, `slidingWindowCounter`)
  - Pure TypeScript implementations of `slidingWindowLog` and `slidingWindowCounter` in `@reqnx/core` (resolving Day 5 gap)
  - Fast-check differential test harness proving exact step-by-step decision equivalence between pure TypeScript and Redis Lua
  - High-concurrency atomicity test (8 clients × 125 concurrent calls = 1,000 requests against limits of 20 and 100)
  - TTL correctness, peek-purity, corrupt-state handling, and time-mode resilience (server `TIME` vs explicit clock vs pre-call mode vs actionable error on rejected `TIME`)
  - Complete Lua mutation pass (17 mutations tested with zero survivors)
  - Benchmarks, operational documentation, and ADRs (ADR-0020 to ADR-0026)
- **Out of scope today:** Leaky bucket, Cluster, Sentinel and failure-injection chaos suites (Day 7), HTTP adapters and headers (Day 7), composite limiters (Day 8), Prometheus metrics (Day 9). The website (`apps/site`) is parked.

---

## 2. Key Architecture Decisions

### ADR-0020: Client Strategy & Structural Adapter Interface
- **Context:** Day 1 chose `ioredis`. Redis documentation now lists `ioredis` maintenance as best-effort and recommends `node-redis` for new projects.
- **Decision:** `@reqnx/redis` depends on an internal structural interface (`RedisClientAdapter`), not on any specific client library. The package has **zero runtime dependencies**.
- **Adapters:**
  - `@reqnx/redis/node-redis`: Primary adapter wrapping `node-redis` (optional peer dep `redis: "^4.7.0 || ^5.0.0"`).
  - `@reqnx/redis/ioredis`: Supported adapter wrapping `ioredis` (optional peer dep `ioredis: "^5.0.0"`).
  - Both adapters normalise arguments/replies, validate safe integers, detect `NOSCRIPT`, and map connection/timeout errors to `StoreError`.
- **Connection Ownership:** A client passed to `createRedisStore` is never closed by the store. A client created internally from a connection URL is owned and closed by the store on `store.close()`. Calling operations on a closed or unconnected client fails immediately with `StoreError` (code `REQNX_CLIENT_CLOSED` or `REQNX_CLIENT_NOT_CONNECTED`), never hanging.

### ADR-0021: Time Source & Server `TIME` Rejection Handling
- **Context:** The store owns the clock. By default, scripts read server time using `redis.call('TIME')` to eliminate inter-node clock skew. Certain managed Redis environments (e.g., AWS ElastiCache Serverless in cluster mode) reject `TIME` inside Lua scripts.
- **Decision:**
  - **Default:** Server `TIME` via `redis.call('TIME')`.
  - **Explicit Clock:** When `clock?: Clock` is provided to `createRedisStore`, the store passes `nowMs` directly as an explicit argument (`ARGV`). Used for deterministic testing with `FakeClock` and client-authoritative environments.
  - **Server Time Rejection:** If a server rejects `TIME` inside a script, the script returns a structured error mapped to `StoreError` with code `REQNX_TIME_REJECTED` and an actionable message directing the operator to either configure `timeMode: 'pre-call'` or provide an explicit `clock`.
  - **Pre-Call Time Mode (`timeMode: 'pre-call'`):** Performs a separate `TIME` round-trip command prior to script invocation and passes the resulting timestamp as `nowMs`. Costs 1 extra round-trip, but preserves server-authoritative time on restrictive proxies.

### ADR-0022: Script Delivery via EVALSHA with EVAL Fallback
- **Context:** The Redis script cache is volatile (cleared on restart, failover, or `SCRIPT FLUSH`). Redis 7 introduced Redis Functions (`FUNCTION LOAD`), which are persistent and replicated.
- **Decision:**
  - Use `EVALSHA` with local SHA1 pre-computation. On `NOSCRIPT`, immediately retry with `EVAL` (which automatically re-populates the script cache).
  - **Why not Redis Functions today?** Functions require deployment-time `FUNCTION LOAD` management, cluster-wide propagation coordination, and elevated permissions that standard rate-limiting service users often lack. `EVALSHA` + `EVAL` is 100% self-healing, zero-configuration, and compatible with all Redis 7.x, 8.x, and Valkey instances.
  - An optional `warmup()` method pre-loads scripts with `SCRIPT LOAD` after connecting or reconnecting to avoid first-call `EVAL` latency.

### ADR-0023: Key Schema & Cluster Hash Tags
- **Context:** Single-key rate limiting operations run atomically on Redis Cluster without `{...}` hash tags.
- **Decision:** Retain key schema `reqnx:{prefix}:{algorithmId}:{identity}` without hash tags. Single-key scripts route directly to the shard owning the key. Omitting hash tags ensures even distribution of different identities across cluster shards. Multi-key scripts (Day 8 composite limiters) will document hash tag requirements.

### ADR-0024: State Encoding, Versioning, and Corrupt-State Policy
- **Decision:** State written with a mismatched `stateVersion` is treated as absent (fresh state), matching `MemoryStore`. Corrupted, oversized, or unparseable state returns a `StoreError` with code `REQNX_CORRUPT_STATE`, invoking the limiter's failure policy. It is never silently treated as fresh capacity.

### ADR-0025: Lua Integer Numerics & Precision Proofs
- **Decision:** Lua 5.1 in Redis uses standard IEEE 754 64-bit double precision floats (max safe integer $2^{53}-1$). Exact rational fixed-point arithmetic (`a/b`), integer divisions via exact floor and ceil helpers with correction steps, and strict validation of inputs ensure zero precision loss. Large numbers are never converted with `tostring` or string concatenation.

### ADR-0026: Redis Test Strategy & TTL Neutralisation
- **Decision:**
  - Differential testing runs fast-check sequences comparing pure TypeScript step functions against the Redis store with explicit clock.
  - Real-time TTL expiration is neutralised during differential step testing by wrapping the algorithm to return a long `stateTtlMs`, since the store queries the algorithm for TTL. Real TTL expiration is verified in dedicated TTL test suites via `PTTL` assertions.
  - Testkit `StoreHarness` adds an optional `capabilities?: { simulatedTtl?: boolean }` flag so `runStoreContractSuite` verifies `PTTL` instead of assuming virtual clock advances affect the Redis server.

---

## 3. Implementation Plan (Three Parts)

### Part 1: Foundations & Fixed Window End-to-End
1. Set up `docker-compose.yml` with pinned Redis (7.2, 7.4) and Valkey (7.2, 8.0) services bound to `127.0.0.1`.
2. Define `RedisClientAdapter` interface in `packages/redis/src/types.ts`.
3. Implement `NodeRedisAdapter` and `IORedisAdapter` with safe integer handling and error normalisation.
4. Implement `ScriptRunner` (local SHA1, `EVALSHA`, fallback to `EVAL` on `NOSCRIPT`, execution stats).
5. Implement Lua build script `packages/redis/scripts/build-lua.ts` and freshness test `tests/script-freshness.test.ts`.
6. Author shared Lua modules (`exact_math.lua`, `time.lua`, `validation.lua`, `result.lua`).
7. Author `fixed-window.lua` and its TypeScript port definition (argument builder, reply parser).
8. Implement `createRedisStore` skeleton supporting `fixedWindow`.
9. Implement differential test harness and `fixed-window.diff.test.ts` (300 fast-check sequences + golden cases).
10. Verify Part 1 pipeline and commit.

### Part 2: Remaining Algorithm Ports & Differential Testing
1. Implement `tokenBucket` Lua port (`token-bucket.lua`), port definition, and `token-bucket.diff.test.ts`.
2. Implement pure TypeScript `slidingWindowLog` in `@reqnx/core` with unit and property tests, and write its port spec `docs/algorithms/sliding-window-log.redis-port.md`.
3. Implement pure TypeScript `slidingWindowCounter` in `@reqnx/core` with unit and property tests, and write its port spec `docs/algorithms/sliding-window-counter.redis-port.md`.
4. Author `sliding-window-log.lua` (sorted set state, score range pruning, tie-breaking member encoding, O(limit) cap) and its differential test suite.
5. Author `sliding-window-counter.lua` (4-field hash, scaled integer comparison, 2x window TTL) and its differential test suite.
6. Verify Part 2 pipeline and commit.

### Part 3: Contract Suite, Atomicity, Chaos, Mutation Pass, Benchmarks & Docs
1. Extend `packages/testkit` `StoreHarness` with `capabilities?: { simulatedTtl?: boolean }` and run `runStoreContractSuite` on `RedisStore`.
2. Implement high-concurrency atomicity test (`atomicity.test.ts`): 8 clients × 125 concurrent calls (1,000 concurrent) with limits of 20 and 100 for all algorithms and both client adapters.
3. Implement TTL and peek-purity integration suite (`ttl.test.ts`): verify PTTL, denied request zero-write invariant, peek zero-mutation invariant, and WRONGTYPE error handling.
4. Implement `NOSCRIPT` and `SCRIPT FLUSH` chaos resilience test (`noscript.test.ts`).
5. Implement time modes and rejection test (`time-modes.test.ts`).
6. Perform manual Lua mutation pass across the 17 specified mutations, recording each catching test.
7. Run Vitest benchmarks on Redis path and write `docs/benchmarks/day-06.md`.
8. Author ADRs 0020 through 0026.
9. Update `packages/redis/README.md`, `CLAUDE.md`, `docs/ROADMAP.md`, and generate a changeset.
10. Verify full monorepo pipeline and generate final completion report.
