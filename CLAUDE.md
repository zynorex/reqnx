# CLAUDE.md — REQNX Cross-Session Memory

> This file is the AI assistant's persistent memory across all 10 days of development.
> Read it at the start of every session. Update it when architecture decisions change.

---

## Architecture Summary

REQNX is a pluggable, distributed-ready rate limiter for Node.js, written in TypeScript.

**v0.1.0 scope:** Five algorithms × two stores × two framework adapters + composite limits + observability.

## The Six Principles

1. **Pure core, impure edges.** Algorithms are pure `step()` functions: `(state | undefined, config, nowMs, cost) → (decision, nextState)`. No I/O, no `Date.now()`, no `Math.random()`.

2. **Atomicity belongs to the store.** MemoryStore runs `step()` synchronously. RedisStore runs equivalent Lua. Stores are NOT get/set adapters.

3. **The store owns the clock.** MemoryStore: injectable `Clock` (`FakeClock` in tests). RedisStore: `redis.call('TIME')` inside Lua, with optional explicit `nowMs` for testing.

4. **One truth, two executors.** Each algorithm exists as TS `step()` and Lua port. Conformance suite replays identical sequences and requires identical decisions.

5. **Core is dependency-free and portable.** `@reqnx/core` has zero runtime deps, no `node:` imports. Runs on Node, Bun, Deno, edge.

6. **Fail explicitly.** Denied = normal `Decision` return. Store failures → `StoreError` → configurable policy (default `fail-open`). `ConfigError` thrown at construction.

## Repo Map

```
packages/core      @reqnx/core      Types, algorithms, MemoryStore, Clock, Duration, errors, headers
packages/redis     @reqnx/redis     RedisStore + Lua scripts (peer dep: ioredis)
packages/express   @reqnx/express   Express middleware (peer dep: express)
packages/fastify   @reqnx/fastify   Fastify plugin (peer dep: fastify)
packages/testkit   @reqnx/testkit   FakeClock + conformance suites (private)
apps/demo-api      private          Demo server
apps/site          private          Astro + Starlight docs & interactive browser playground
docs/              architecture.md, adr/, ROADMAP.md
scripts/           check-deps.ts (dependency graph linter)
```

## Exact Commands

```bash
# Install
pnpm install

# Full verification
pnpm verify

# Individual checks
pnpm lint                    # ESLint flat config
pnpm lint:fix                # Auto-fix
pnpm format:check            # Prettier check
pnpm typecheck               # tsc --noEmit (all packages)
pnpm test                    # Vitest run (all packages)
pnpm test:watch              # Vitest watch mode
pnpm build                   # tsdown build (all packages)
pnpm check-packages          # publint + @arethetypeswrong/cli
pnpm check-deps              # Dependency graph rules

# Benchmarks
pnpm bench                   # Full benchmark suite (Vitest + memory footprint)
pnpm bench:vitest            # Vitest throughput benchmarks
pnpm bench:memory            # Memory footprint benchmark (--expose-gc)

# Single package
pnpm --filter @reqnx/core test
pnpm --filter @reqnx/core build

# Redis for integration tests
docker compose up -d
docker compose down
```

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)
- **Imports:** Use `.js` extension (verbatimModuleSyntax)
- **Types:** No `any` (ESLint-enforced). Use `unknown` + narrowing.
- **Clock:** Only `clock.ts` may call `Date.now()`. All other code receives time via `Clock` or function parameter.
- **Errors:** `RateLimitError` base class (Symbol.for branding). `ConfigError` for bad config (thrown). `StoreError` for store failures (caught by policy). `InputError` for bad per-call input (thrown, HTTP 400).
- **Key schema:** `reqnx:{prefix}:{algorithmId}:{identity}` — max 512 bytes; oversized keys rejected with `InputError` (never silently hashed or truncated).
- **Testing:** Use `FakeClock` only. No real timers (`setTimeout`, `setInterval`) in core/store tests. Run contract suites (`runStoreContractSuite`, `runAlgorithmContractSuite`) for all store and algorithm implementations.

## Definition of Done: New Algorithm

1. ✅ Pure TS `step()` + `peek()` + `parseConfig()` + `stateTtlMs()`
2. ✅ Lua port in `@reqnx/redis`
3. ✅ Conformance suite cases in `@reqnx/testkit`
4. ✅ Property-based tests (fast-check)
5. ✅ Unit tests for edge cases
6. ✅ TSDoc documentation
7. ✅ Benchmark entry

## Rule: Ask Before Adding Dependencies

`@reqnx/core` must have ZERO runtime dependencies. Any new dependency in any package requires explicit approval. Check if it's already in the project first.

## Key Types Quick Reference

```typescript
type Duration = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

interface Decision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterMs: number;
  degraded: boolean;
}

interface Algorithm<Config, State> {
  id: AlgorithmId;
  stateVersion: number;
  parseConfig(input: unknown): Config;
  step(
    state: State | undefined,
    config: Config,
    nowMs: number,
    cost: number,
  ): { decision: Decision; nextState: State };
  peek(state: State | undefined, config: Config, nowMs: number): Decision;
  stateTtlMs(config: Config): number;
}

interface Store {
  id: string;
  consume<C, S>(algo: Algorithm<C, S>, key: string, config: C, cost: number): Promise<Decision>;
  peek<C, S>(algo: Algorithm<C, S>, key: string, config: C): Promise<Decision>;
  reset(key: string): Promise<void>;
  close(): Promise<void>;
  keys?(prefix: string): AsyncIterable<string>;
}

type StoreErrorPolicy = 'fail-open' | 'fail-closed' | ((error, ctx) => Decision);
```

## Progress Tracker

- [x] Day 1: Architecture + scaffold
- [x] Day 2: Core infrastructure (Clock, Duration, MemoryStore, createLimiter, testkit)
- [x] Day 3A: Fixed window algorithm (pure step, tests, contract suite, docs, benchmark entry; Lua port pending Day 6)
- [x] Day 3B: Website foundation (Astro + Starlight docs, Preact interactive playground, browser FakeClock, ADRs 0011-0013)
- [ ] Day 4: Token bucket algorithm
- [ ] Day 5: Sliding window (log + counter)
- [ ] Day 6: Leaky bucket + RedisStore + Lua
- [ ] Day 7: Express/Fastify adapters + headers
- [ ] Day 8: Tiered/composite limits, admin API
- [ ] Day 9: Prometheus, structured logs, Grafana
- [ ] Day 10: Load tests, benchmarks, TypeDoc, npm publish v0.1.0
