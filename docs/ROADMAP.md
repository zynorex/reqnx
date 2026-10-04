# REQNX Roadmap

> Target: v0.1.0 published to npm on Day 10

## Day 1 — Architecture & Scaffold ✅

- Contracts (types only, full TSDoc)
- Package shells for all 5 packages + demo app
- ADRs, architecture doc, roadmap
- Tooling: pnpm workspaces, TypeScript strict, ESLint, Prettier, Vitest, tsdown
- CI pipeline, Changesets, CLAUDE.md
- Smoke tests pass for all packages

## Day 2 — Core Infrastructure ✅

- `Clock` (`SystemClock` + `@reqnx/testkit` `FakeClock`)
- `Duration` parsing (`parseDuration`) with strict validation, fractional whole-ms support, and 366-day cap
- Error hierarchy (`RateLimitError`, `ConfigError`, `StoreError`, `InputError`) with `Symbol.for` cross-boundary branding
- `buildKey()` and `validateKey()` rejecting oversized keys with `InputError` (no silent truncation/hashing)
- `MemoryStore` — synchronous single-threaded atomicity, bounded incremental sweeping, `maxKeys` cap, and O(1) LRU eviction
- `createLimiter()` factory wiring, static and async dynamic resolvers, failure policies (`fail-open`, `fail-closed`, custom), `degraded: true` marker, hook isolation
- `@reqnx/testkit` — `FakeClock`, store and algorithm contract suites, test algorithm fixtures, broken doubles, and negative control tests
- 100% statements coverage on new core files, full property tests (fast-check)

## Day 3 — Fixed Window Algorithm ✅

- Pure TS `step()` implementation with epoch-aligned windows and monotonicity on backwards clock
- Strict `parseConfig()` validation (`limit` in $[1, 2^{31}-1]$, `window` via `parseDuration`, unknown keys rejected)
- `peek()` read-only capacity check
- `stateTtlMs()` derivation and explicit TTL invariant
- Comprehensive unit tests: golden examples, boundary rollover, huge cost, edge cases
- Boundary burst test documenting intended $2\times \text{limit}$ behavior
- Property-based tests (fast-check) and independent naive model-based oracle
- Testkit algorithm contract suite passing unchanged (`runAlgorithmContractSuite`)
- Full mutation pass (8 mutations, zero survivors)
- Benchmark baseline: pure step throughput (>12M ops/s), MemoryStore throughput (>330k ops/s), and memory footprint (~273 B/key at 100k keys)
- Docs: user-facing guide (`docs/algorithms/fixed-window.md`), Redis port spec (`docs/algorithms/fixed-window.redis-port.md`), and ADR-0010

## Day 4 — Token Bucket Algorithm

- Pure TS `step()` implementation
- Continuous refill model
- Conformance test cases
- Unit tests + property-based tests

## Day 5 — Sliding Window Algorithms

- Sliding Window Log — sorted-set-based state
- Sliding Window Counter — dual-window weighted estimate
- Conformance test cases for both
- Unit tests + property-based tests

## Day 6 — Leaky Bucket + RedisStore + Lua

- Leaky Bucket algorithm (pure TS)
- `RedisStore` implementation (ioredis + EVALSHA)
- Lua ports for Fixed Window and Token Bucket
- Lua ports for Sliding Window Log, Sliding Window Counter, Leaky Bucket
- Differential tests: TS step() vs Lua for all five algorithms
- Redis integration tests (docker-compose)

> ⚠️ **This is the heaviest day.** If Lua ports for all 5 algorithms don't fit,
> the sliding-window and leaky-bucket Lua ports spill into Day 7 morning.

## Day 7 — Framework Adapters + Headers

- `decisionToHeaders()` — pure function in core
- IETF draft-11 `RateLimit` + `RateLimit-Policy` headers
- Legacy `X-RateLimit-*` headers
- `Retry-After` per RFC 9110
- `@reqnx/express` middleware
- `@reqnx/fastify` plugin
- Demo API server (apps/demo-api)
- Integration tests for both adapters

## Day 8 — Tiered & Composite Limits

- `ConfigResolver` for tiered limits (free/pro/enterprise)
- Composite limiter (N rules, all-must-pass, no leaked consumption)
- Allow/deny lists (middleware-level)
- Admin API endpoints (peek, reset, list keys)

## Day 9 — Observability

- Prometheus metrics via `onDecision`/`onError` hooks
- Histogram for latency, counters for allowed/denied/errors
- Structured JSON logging
- Docker Compose with Grafana + Prometheus
- Dashboard JSON

## Day 10 — Ship It

- k6 load tests
- Benchmark suite (ops/sec per algorithm × store)
- TypeDoc generated API docs on GitHub Pages
- CI/CD: Changesets publish workflow
- Final `publint` + `@arethetypeswrong/cli` verification
- npm publish `v0.1.0` for core, redis, express, fastify
- README polish, badges, examples
