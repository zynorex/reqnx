# ADR-0001: Package Boundaries

**Status:** Accepted  
**Date:** 2026-10-01

## Context

REQNX needs to support multiple stores (memory, Redis), multiple frameworks (Express, Fastify), and a test toolkit. We need clear boundaries that minimize coupling, allow independent versioning, and keep the core portable.

## Decision

Monorepo with pnpm workspaces, five published packages plus one private testkit:

| Package            | npm name         | Runtime deps   | Peer deps |
| ------------------ | ---------------- | -------------- | --------- |
| `packages/core`    | `@reqnx/core`    | **none**       | none      |
| `packages/redis`   | `@reqnx/redis`   | `@reqnx/core`  | `ioredis` |
| `packages/express` | `@reqnx/express` | `@reqnx/core`  | `express` |
| `packages/fastify` | `@reqnx/fastify` | `@reqnx/core`  | `fastify` |
| `packages/testkit` | `@reqnx/testkit` | `@reqnx/core`  | none      |
| `apps/demo-api`    | private          | core + express | none      |

**Rules enforced by `scripts/check-deps.ts`:**

1. `@reqnx/core` has zero runtime dependencies and no `node:` imports.
2. Adapters (`express`, `fastify`) never depend on each other.
3. No package has a runtime dependency on `@reqnx/testkit`.

## Consequences

- Core runs on Node, Bun, Deno, and edge runtimes.
- Users install only what they need (`core` + `redis` + `express`).
- Adapters can evolve independently.
- Testkit stays private until third-party store authors emerge (see ADR-0008 note).

## Alternatives Considered

- **Single package with optional peer deps**: Simpler install but drags in unnecessary type surface and makes tree-shaking harder.
- **Fully independent repos**: Too much overhead for a small team; cross-repo PRs for breaking changes are painful.
