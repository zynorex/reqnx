# Day 7 Plan: Leaky Bucket (Meter), Redis Resilience & Chaos Engineering, Concurrency, Cluster Smoke & Operations Guide

**Branch:** `day-7-resilience`  
**Status:** In Progress (Plan approved, starting Part 1)

---

## 1. Context & Objectives

Day 7 completes the algorithm suite with the fifth algorithm—**leaky bucket (as a meter)**—and hardens `@reqnx/redis` for real-world production reliability and chaos:
1. **Part 1: Leaky Bucket (Meter)**: Ship `leakyBucket` with its own algorithm id (`leaky-bucket`), water-metaphor vocabulary (`capacity`, `leak`, `interval`), exact integer arithmetic delegating to `tokenBucket`, mathematical equivalence proof, water oracle, curve-1 tests, comparison harness integration, 100% test coverage, and a mutation table.
2. **Part 2: Redis Store Resilience & Chaos Engineering**: Build in-repo zero-dependency TCP `ChaosProxy` (`node:net`), integrate per-call `timeoutMs`, `maxPending` bulkhead, closed/open/half-open `circuitBreaker` with injectable `Clock`, `ping()`, extended `stats()`, client fail-fast options (`ioredis` and `node-redis`), and lost-reply analysis.
3. **Part 3: Concurrency at Scale**: 8-process multi-process atomicity (2,000 requests against 1 key, 0 errors, exactly limit admitted) and clock-skew independence.
4. **Part 4: Topology, Operations Guide & Benchmarks**: Replica read-only rejection, Cluster smoke test without CROSSSLOT errors, Sentinel failover docs, least-privilege ACL, `docs/ops/redis.md`, benchmark numbers, ADRs (0027 to 0033), and changesets.

---

## 2. Hard Rules

- **Zero Core Contract Changes**: No changes to `Store`, `Limiter`, `Decision`, or `@reqnx/testkit`.
- **Zero Runtime Dependencies in Core**: Core remains timer-free and Node API-free.
- **Never More Generous on Error**: Redis failures always surface as `StoreError`. Degraded decisions stay marked. No silent internal retries that could double count.
- **Timer Safety & Fast Default Runs**: Real-time chaos and timeout tests live in `integration-slow` projects and bounded polling; default unit runs remain timer-free with `FakeClock`.
- **Parked Website**: `apps/site` remains untouched.

---

## 3. File-by-File Change List

### Part 1: Leaky Bucket (Meter)
- `packages/core/src/algorithms/leaky-bucket.ts` (new): Leaky bucket meter implementation.
- `packages/core/src/algorithms/__tests__/leaky-bucket.test.ts` (new): Unit tests, properties, oracle, curve-1, mutations.
- `packages/core/src/index.ts` (modify): Export `leakyBucket` and types.
- `packages/redis/src/ports/leaky-bucket.ts` (new): `leakyBucketRedisPort` reusing token-bucket Lua script.
- `packages/redis/src/ports/registry.ts` (modify): Register `leakyBucketRedisPort`.
- `packages/redis/src/index.ts` (modify): Export `leakyBucketRedisPort`.
- `packages/redis/src/__tests__/differential/leaky-bucket.diff.test.ts` (new): Pure vs Redis differential tests.
- `scripts/compare-algorithms.ts` (modify): Include leaky bucket scenarios in comparison harness.
- `docs/algorithms/leaky-bucket.md` (new): Algorithmic specification and worked examples.
- `docs/algorithms/leaky-bucket.redis-port.md` (new): Redis Lua port documentation.

### Part 2: Failure Engineering for RedisStore
- `packages/redis/test/support/chaos-proxy.ts` (new): Pure `node:net` TCP proxy with switchable failure modes.
- `packages/redis/test/support/chaos-proxy.test.ts` (new): ChaosProxy unit tests.
- `packages/redis/src/resilience/timeout.ts` (new): Per-call timeout wrapper with timer cleanup and abandoned promise catch.
- `packages/redis/src/resilience/bulkhead.ts` (new): In-flight concurrency limiter (`maxPending`).
- `packages/redis/src/resilience/circuit-breaker.ts` (new): Closed/Open/Half-Open circuit breaker with injectable Clock.
- `packages/redis/src/resilience/__tests__/circuit-breaker.test.ts` (new): Breaker unit tests with FakeClock.
- `packages/redis/src/adapters/base.ts` (modify): Extend `RedisErrorCode` and error classification.
- `packages/redis/src/types.ts` (modify): Add resilience options and extended stats.
- `packages/redis/src/store.ts` (modify): Wire timeout, bulkhead, breaker, ping, and stats.
- `packages/redis/src/__tests__/chaos/outage.test.ts` (new): Outage and fail-open/fail-closed tests.
- `packages/redis/src/__tests__/chaos/lost-reply.test.ts` (new): Lost reply and duplicate execution tests.
- `packages/redis/src/__tests__/chaos/slow-redis.test.ts` (new): Latency injection tests.
- `packages/redis/src/__tests__/chaos/slice-and-limits.test.ts` (new): 1-byte frame slicing and connection limit tests.
- `packages/redis/src/__tests__/chaos/negative-controls.test.ts` (new): Negative controls mutation suite.

### Part 3: Concurrency at Scale
- `packages/redis/src/__tests__/concurrency/worker.ts` (new): IPC barrier child worker.
- `packages/redis/src/__tests__/concurrency/multi-process.test.ts` (new): 8-process atomicity test against 1 key.
- `packages/redis/src/__tests__/concurrency/clock-skew.test.ts` (new): Clock-skew invariance test.

### Part 4: Replica, Cluster, Sentinel, Valkey, Ops Guide & Benchmarks
- `docker-compose.yml` (modify): Profiles: `default`, `replica`, `cluster`, `sentinel`.
- `packages/redis/src/__tests__/integration/replica.test.ts` (new): Replica readonly consume rejection and peek support.
- `packages/redis/src/__tests__/integration/cluster.test.ts` (new): Cluster smoke tests.
- `packages/redis/src/__tests__/integration/acl.test.ts` (new): Least privilege ACL validation.
- `docs/ops/redis.md` (new): Production Redis operations guide.
- `docs/benchmarks/day-07.md` (new): Performance and failure latency benchmarks.
- `docs/adr/0027-leaky-bucket-meter-and-token-bucket-equivalence.md` to `0033` (new ADRs).
- `CLAUDE.md`, `README.md`, `docs/ROADMAP.md` (modify): Documentation and checklist updates.
- `.changeset/day-7-resilience.md` (new): Monorepo changeset.

---

## 4. Part-by-Part Status

- [ ] **Part 1: Leaky Bucket (Meter)**
- [ ] **Part 2: Failure Engineering for RedisStore**
- [ ] **Part 3: Concurrency at Scale**
- [ ] **Part 4: Replica, Cluster, Sentinel, Ops Guide, Benchmarks & ADRs**
