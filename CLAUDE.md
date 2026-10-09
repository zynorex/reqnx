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

# Website & Docs
pnpm --filter @reqnx/site dev        # Run Astro development server
pnpm --filter @reqnx/site build      # Build static docs and landing page
pnpm --filter @reqnx/site run a11y   # Axe accessibility audit (Desktop/Mobile, Dark/Light)
pnpm --filter @reqnx/site run shots  # Capture multi-viewport screenshot matrix
pnpm --filter @reqnx/site run brand:build # Re-generate responsive brand asset derivatives

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
- **Numerics & Exact Arithmetic:** Rates across all algorithms must use exact integer fixed-point arithmetic (e.g. Euclidean GCD coprime `(a, b)` reduction). Floating-point rate representation and accumulation are strictly prohibited. All intermediate calculations must remain bounded within safe integer limits (`2^53 - 1`, `capacityUnits <= 2^51`) to guarantee identical results across V8, edge runtimes, and Redis Lua 5.1 doubles.
- **Brand & Mascot Usage:** Master assets in `brand/` are strictly read-only. Derivatives are generated via `brand:build` and hashed in `brand/manifest.json`. In Astro components, reference typed descriptors from `apps/site/src/brand.ts`. Mascot placement is permitted ONLY in hero background/peeking, open source badge, final CTA companion, 404 recovery page, and footer cameo. Mascot is strictly barred from data tables, live console output logs, code recipes, and FAQ disclosures.
- **Landing Page Copy Policy:** Zero marketing hype words ("blazing fast", "revolutionary", "zero-overhead", "unrivaled"). Tone is technical, calm, and honest. All factual claims must be recorded in `docs/site/claims.md` with verifiable commands or code paths. Feature availability gating must query `apps/site/src/features.ts` (with valid `evidencePath`).
- **404 Routing & Recovery:** Handled via `apps/site/src/pages/404.astro` (`disable404Route: true` in Starlight config) emitting a single static `dist/404.html` with client-side fuzzy path recovery matching against known routes.
- **Accessibility:** All pages must pass Axe audits with 0 serious or critical violations across both dark and light modes. Interactive scroll areas (`overflow-x: auto`) must declare `tabindex="0" role="region" aria-label="..."`. Button text and link contrast must satisfy WCAG AA ($\ge 4.5:1$).

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
- [x] Day 3C / Landing v2: Production landing page at `/` (14 sections, live instrument Preact islands, Bento grid, Boundary burst, honest trade-offs) and branded 404 recovery page at `/404`, brand asset pipeline, Axe a11y 0 violations, ADRs 0015-0018
- [x] Day 4: Token bucket algorithm (pure step, rational fixed-point arithmetic, model oracle, property tests, integration tests, contract suite, docs, benchmark entry; Lua port pending Day 6)
- [ ] Day 5: Sliding window (log + counter)
- [ ] Day 6: Leaky bucket + RedisStore + Lua
- [ ] Day 7: Express/Fastify adapters + headers
- [ ] Day 8: Tiered/composite limits, admin API
- [ ] Day 9: Prometheus, structured logs, Grafana
- [ ] Day 10: Load tests, benchmarks, TypeDoc, npm publish v0.1.0
