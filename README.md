# REQNX

> Pluggable, distributed-ready rate limiter for Node.js — written in TypeScript.

REQNX gives you five battle-tested algorithms, atomic in-memory and Redis stores, and drop-in Express/Fastify middleware. The core is dependency-free, portable to any JS runtime, and designed for correctness: every algorithm is a pure function, every store guarantees atomic check-and-update, and a shared conformance suite proves they agree.

## Quick Start

```typescript
import { createLimiter, SystemClock } from '@reqnx/core';
import { MemoryStore } from '@reqnx/core';
import { fixedWindow } from '@reqnx/core/algorithms';
import { rateLimiter } from '@reqnx/express';

// Create a limiter: 100 requests per minute
const limiter = createLimiter({
  algorithm: fixedWindow,
  store: new MemoryStore({ clock: SystemClock }),
  prefix: 'api',
  config: { max: 100, window: '1m' },
});

// Use as Express middleware
app.use(rateLimiter({ limiter }));
```

## Features

- 🏗️ **Five algorithms** — Fixed window, sliding window (log + counter), token bucket, leaky bucket
- ⚡ **Two stores** — In-memory (zero deps) and Redis (atomic Lua scripts, Cluster-safe)
- 🔌 **Framework adapters** — Express and Fastify, with shared header generation
- 🎯 **Pure core** — Algorithms are deterministic state-transition functions, trivially testable
- 🔒 **Atomic by design** — No WATCH/retry; Redis uses single-key Lua scripts
- 📊 **Observable** — Hooks for Prometheus metrics and structured logging
- 🌐 **Portable** — Core runs on Node, Bun, Deno, edge runtimes (zero `node:` imports)

## Documentation

- [Architecture](docs/architecture.md) — design principles and Mermaid diagrams
- [Roadmap](docs/ROADMAP.md) — 10-day development plan
- [ADRs](docs/adr/) — architectural decision records

## Status

🚧 **Pre-release** — under active development. See the [roadmap](docs/ROADMAP.md) for progress.

## License

[MIT](LICENSE)
