<p align="center">
  <img src="brand/logo.png" width="128" height="128" alt="Reqnx Logo" />
</p>

# REQNX

> Pluggable, distributed-ready rate limiter for Node.js — written in TypeScript.

REQNX gives you five battle-tested algorithms, atomic in-memory and Redis stores, and drop-in Express/Fastify middleware. The core is dependency-free, portable to any JS runtime, and designed for correctness: every algorithm is a pure function, every store guarantees atomic check-and-update, and a shared conformance suite proves they agree.

## Quick Start

```typescript
import { createLimiter, createMemoryStore, fixedWindow } from '@reqnx/core';

// Create a limiter: 100 requests per minute
const limiter = createLimiter({
  algorithm: fixedWindow,
  store: createMemoryStore(),
  prefix: 'api',
  config: { limit: 100, window: '1m' },
});

const decision = await limiter.check('user-123');
if (!decision.allowed) {
  console.log(`Rate limited! Retry after ${decision.retryAfterMs}ms`);
}
```

## Algorithms

| Algorithm                  | Status         | In-Memory   | Redis (Lua) | Docs                                             |
| -------------------------- | -------------- | ----------- | ----------- | ------------------------------------------------ |
| **Fixed Window Counter**   | ✅ Implemented | ✅ Complete | ⏳ Day 6    | [Documentation](docs/algorithms/fixed-window.md) |
| **Token Bucket**           | ✅ Implemented | ✅ Complete | ⏳ Day 6    | [Documentation](docs/algorithms/token-bucket.md) |
| **Sliding Window Log**     | ⏳ Planned     | ⏳ Day 5    | ⏳ Day 6    | —                                                |
| **Sliding Window Counter** | ⏳ Planned     | ⏳ Day 5    | ⏳ Day 6    | —                                                |
| **Leaky Bucket**           | ⏳ Planned     | ⏳ Day 6    | ⏳ Day 6    | —                                                |

## Features

- 🏗️ **Five algorithms** — Fixed window, sliding window (log + counter), token bucket, leaky bucket
- ⚡ **Two stores** — In-memory (zero deps) and Redis (atomic Lua scripts, Cluster-safe)
- 🔌 **Framework adapters** — Express and Fastify, with shared header generation
- 🎯 **Pure core** — Algorithms are deterministic state-transition functions, trivially testable
- 🔒 **Atomic by design** — No WATCH/retry; Redis uses single-key Lua scripts
- 📊 **Observable** — Hooks for Prometheus metrics and structured logging
- 🌐 **Portable** — Core runs on Node, Bun, Deno, edge runtimes (zero `node:` imports)

## Documentation & Website

- [Architecture](docs/architecture.md) — design principles and Mermaid diagrams
- [Roadmap](docs/ROADMAP.md) — 10-day development plan
- [ADRs](docs/adr/) — architectural decision records
- [Brand Guidelines](brand/README.md) — asset rules, roles, and checksums

### Interactive Website & Docs

The documentation and interactive landing page live in `apps/site` (built with Astro & Starlight):

```bash
# Start local docs server
pnpm --filter @reqnx/site dev

# Build static production site
pnpm --filter @reqnx/site build

# Run Axe accessibility test suite (0 serious/critical violations)
pnpm --filter @reqnx/site run a11y

# Capture multi-viewport screenshot matrix
pnpm --filter @reqnx/site run shots
```

## Status

🚧 **Pre-release** — under active development. See the [roadmap](docs/ROADMAP.md) for progress.

## License

[MIT](LICENSE)
