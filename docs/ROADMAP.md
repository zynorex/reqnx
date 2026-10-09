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

## Day 3A — Fixed Window Algorithm ✅

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

## Day 3B — Website Foundation ✅

- Astro + Starlight static documentation engine with Preact interactive islands (`apps/site`)
- Engineering blueprint visual direction with dark theme, indigo/cyan accents, and custom tokens
- In-browser simulated demo runner using real `@reqnx/core` and deterministic `BrowserFakeClock`
- Interactive playground (`/playground/`) with parameter adjustments, presets, and request timeline
- Fixed Window algorithm page (`/algorithms/fixed-window/`) with embedded interactive simulator
- Getting started guide (`/getting-started/`) and algorithm comparison matrix (`/algorithms/`)
- ADR-0011 (Website Technology Stack), ADR-0012 (Browser Demo Architecture), ADR-0013 (Base-Path & SEO Guardrails)
- Multi-project Vitest integration and build pipeline validation

## Day 3C — Landing Page v2 & Branded 404 ✅

- Production landing page at `/` featuring 14 developer-focused sections in exact spec sequence:
  - Header & Brand Navigation with live theme toggle and responsive layout
  - Hero with dual live browser rate limiter console (`LiveConsole` Preact island for Fixed Window & Token Bucket)
  - Social proof & technical verification strip (257 passing tests, 8 packages, 0 deps, strictly typed)
  - What It Is & Core Decision shape breakdown
  - Why Choose Reqnx: 12-column Bento grid of 6 core guarantees, 3-layer architecture, and honest "When NOT to use" section
  - The Seam: 3-frame animated window boundary burst engine (proving $2\times$ burst phenomena)
  - Algorithm selection matrix & ARIA-compliant tabbed traits comparison
  - Interactive Quickstart with verified runtime output table for Core, Express, Fastify, and Redis
  - Tested production recipe cards (tiering, burst buffer, cost-weighted AI tokens) with real Decision outputs
  - Architecture interactive execution flow with runtime compatibility matrix (Node, Bun, Deno, Edge)
  - Real-time project maturity status meter backed by `features.ts` and repository evidence paths
  - Deep technical FAQ with 14 detailed answers across 4 categories
  - Open Source & Community governance with MIT terms and recent 5 ADRs log
  - Final CTA with coordinate grid tick motif, companion mascot, and one-click copyable install snippet
  - Footer with site-wide navigation, GitHub links, and subtle brand badge
- Custom branded 404 page (`/404.astro`) emitting standalone `dist/404.html` via Starlight override:
  - Official distressed mascot artwork (`brand/404.png`)
  - Client-side fuzzy path recovery with Levenshtein route matching against known documentation paths
- Brand asset pipeline (`scripts/brand-build.ts`) generating responsive WebP/PNG derivatives, multi-resolution `favicon.ico`, and `site.webmanifest` verified by SHA-256 manifest
- Zero marketing hype words, strictly adhering to claims ledger (`docs/site/claims.md`)
- 100% WCAG AA compliant with Axe accessibility audit passing with 0 serious/critical violations
- ADR-0015 (Landing Architecture & Art Direction), ADR-0016 (Brand Asset Pipeline & Usage Rules), ADR-0017 (Not Found Page & Route Manifest), ADR-0018 (Content System & Claims Ledger)

## Day 4 — Token Bucket Algorithm ✅

- Pure TS `step()` implementation with exact rational fixed-point arithmetic (`a/b` coprime integers)
- Continuous refill model with integer GCD normalisation and zero floating-point drift
- Strict `parseConfig()` validation (`capacity`, `refillTokens`, `refillInterval`, capacityUnits <= 2^51, 366-day cap)
- `peek()` read-only capacity check and `stateTtlMs()` matching full refill duration
- Comprehensive unit tests: Golden Examples A, B, C, backwards clock, dynamic config changes, bounds, exactness
- Model-based oracle test suite (1,000 runs against discrete 1-ms reference simulator)
- Property-based tests (7 invariants via fast-check): rate envelope, idempotence, monotonicity, backwards clock
- High-concurrency integration tests: 1,000 concurrent requests, sustained load at 2x rate, key isolation
- Full mutation pass (15 mutations, zero survivors)
- Benchmarks: pure `step()` throughput (>17M ops/s), Limiter MemoryStore (>800k ops/s), memory footprint (~295.8 B/key)
- Docs: user-facing guide (`docs/algorithms/token-bucket.md`), Redis port spec (`docs/algorithms/token-bucket.redis-port.md`), and ADR-0014

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
