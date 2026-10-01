# ADR-0007: Testing Strategy

**Status:** Accepted  
**Date:** 2026-10-01

## Context

REQNX has algorithms implemented twice (TS and Lua) and stores with different atomicity models. The testing strategy must catch drift between implementations, validate invariants across algorithms, and keep the test suite fast enough to run on every push.

## Decision

### Test framework: Vitest

Vitest in **projects mode** — one project per package. `v8` coverage provider.

### Test categories

| Category | Location | What it tests | Speed |
|----------|----------|---------------|-------|
| Unit tests | `packages/*/src/**/*.test.ts` | Individual functions in isolation | < 1s per test |
| Conformance tests | `packages/testkit/` → used by core + redis | TS step() vs Lua produce identical decisions for identical inputs | ~1s per suite |
| Property tests | `packages/core/src/**/*.test.ts` | Algorithm invariants via fast-check | ~5s per algorithm |
| Integration tests | `packages/redis/src/**/*.test.ts` | RedisStore + real Redis | Requires Docker |

### Conformance suite

Located in `@reqnx/testkit`. For each algorithm:

1. Define a set of `ConformanceCase<Config>` — ordered `(atMs, cost)` sequences with expected `Decision` at each step.
2. `runConformanceSuite()` replays each case against:
   - **TS executor**: `MemoryStore` with `FakeClock` set to each step's `atMs`.
   - **Lua executor**: `RedisStore` with `nowMs` override in the Lua script.
3. Both must produce **identical** `Decision` objects at every step.

This catches drift between TS and Lua implementations.

### FakeClock

`FakeClock` implements the `Clock` interface with manually controlled time. Tests advance time explicitly — no wall-clock dependency, no flaky timeouts.

### Property-based tests (fast-check)

For each algorithm, property tests assert:
- `remaining` is always ≥ 0 and ≤ `limit`
- `retryAfterMs` is 0 when `allowed` is true, > 0 when false
- `resetAtMs` is always in the future (≥ nowMs)
- After waiting `retryAfterMs`, a request with cost=1 should succeed
- `step(state, config, now, cost)` is deterministic (same inputs → same outputs)

### Redis integration tests

Guarded by a check for a running Redis instance (`REDIS_URL` env var or Docker Compose). Skipped in CI if Redis is unavailable. CI runs them in a job with `docker-compose up`.

### Definition of done for a new algorithm

1. Pure TS `step()` function + `peek()` + `parseConfig()` + `stateTtlMs()`
2. Lua port in `@reqnx/redis`
3. Conformance suite cases in `@reqnx/testkit`
4. Property-based tests in core
5. Unit tests for edge cases
6. TSDoc documentation
7. Benchmark entry

## Consequences

- High confidence that TS and Lua implementations agree
- Property tests catch edge cases that hand-written tests miss
- Fast unit tests run on every push; Redis tests run in CI with Docker
- FakeClock eliminates time-dependent test flakiness

## Alternatives Considered

- **Jest**: Slower, worse ESM support in 2026. Vitest is the standard.
- **No conformance suite**: Risk of TS/Lua drift going undetected. Unacceptable.
- **Snapshot testing for Decisions**: Brittle, doesn't catch logical errors. Property tests are superior.
