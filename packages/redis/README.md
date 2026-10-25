# @reqnx/redis

> Distributed, atomic rate limiting store for `@reqnx/core` powered by Redis Lua scripts.

`@reqnx/redis` executes rate limiting algorithms atomically inside Redis using single-key Lua scripts. It guarantees strict race-free quota enforcement across distributed application instances with zero runtime dependencies.

---

## Features

- 🔒 **Atomic Check-and-Update**: Single-key Lua execution eliminates race conditions under heavy concurrency.
- 📦 **Zero Runtime Dependencies**: Depends only on an internal structural adapter interface.
- 🔌 **Client-Agnostic**: Optional first-class subpath adapters for both `node-redis` and `ioredis`.
- 🔄 **Self-Healing Script Delivery**: Executes via `EVALSHA` with precomputed SHA1 hashes and transparent fallback to `EVAL` on `NOSCRIPT`.
- 🕒 **Server Authoritative Time**: Reads server time via `redis.call('TIME')` to eliminate clock drift across application nodes, with `timeMode: 'pre-call'` for restrictive proxies.
- 🛡️ **Strict Quota Invariants**: Denied requests never write state and never touch TTL. Mismatched versions reset cleanly. Corrupt state triggers structured errors instead of granting capacity.

---

## Installation

```bash
# Core + Redis store
pnpm add @reqnx/core @reqnx/redis

# Install your preferred client driver (optional peer dependency)
pnpm add redis
# OR
pnpm add ioredis
```

---

## Usage

### With `node-redis` (Recommended)

```typescript
import { createClient } from 'redis';
import { createLimiter, fixedWindow } from '@reqnx/core';
import { createRedisStore } from '@reqnx/redis';
import { createNodeRedisAdapter } from '@reqnx/redis/node-redis';

const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
await client.connect();

const store = createRedisStore({
  client: createNodeRedisAdapter(client),
});

const limiter = createLimiter({
  algorithm: fixedWindow,
  store,
  prefix: 'api',
  config: { limit: 100, window: '1m' },
});

const decision = await limiter.check('user-123');
if (!decision.allowed) {
  console.log(`Rate limited! Retry after ${decision.retryAfterMs}ms`);
}
```

### With `ioredis`

```typescript
import Redis from 'ioredis';
import { createLimiter, tokenBucket } from '@reqnx/core';
import { createRedisStore } from '@reqnx/redis';
import { createIORedisAdapter } from '@reqnx/redis/ioredis';

const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const store = createRedisStore({
  client: createIORedisAdapter(client),
});

const limiter = createLimiter({
  algorithm: tokenBucket,
  store,
  prefix: 'api',
  config: { capacity: 20, refillTokens: 5, refillInterval: '1s' },
});
```

---

## Time Modes

By default, scripts execute server-authoritative time directly via `redis.call('TIME')`:

```typescript
// Default: Server-authoritative time inside script
const store = createRedisStore({ client: adapter });

// Restrictive managed proxies (e.g., AWS ElastiCache Serverless rejecting TIME in scripts)
const store = createRedisStore({
  client: adapter,
  timeMode: 'pre-call', // performs TIME command round-trip before script
});

// Deterministic testing with FakeClock
const store = createRedisStore({
  client: adapter,
  clock: fakeClock, // passes timestamp directly via ARGV
});
```

---

## Script Preloading & Telemetry

```typescript
// Preload scripts into Redis script cache on startup
await store.warmup();

// Inspect execution stats
console.log(store.stats());
// {
//   evalshaCalls: 12480,
//   evalFallbacks: 0,
//   errors: { connection: 0, timeout: 0, script: 0, ... }
// }
```

---

## License

MIT
