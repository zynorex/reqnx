# REQNX Architecture

> Pluggable, distributed-ready rate limiter for Node.js

## Package Dependency Graph

```mermaid
graph TD
    CORE["@reqnx/core<br/>Types · Algorithms · MemoryStore<br/>Zero runtime deps"]
    REDIS["@reqnx/redis<br/>RedisStore + Lua scripts<br/>peer: ioredis"]
    EXPRESS["@reqnx/express<br/>Express middleware<br/>peer: express"]
    FASTIFY["@reqnx/fastify<br/>Fastify plugin<br/>peer: fastify"]
    TESTKIT["@reqnx/testkit<br/>FakeClock · Conformance suites<br/>(private)"]
    DEMO["apps/demo-api<br/>(private)"]

    REDIS --> CORE
    EXPRESS --> CORE
    FASTIFY --> CORE
    TESTKIT --> CORE
    DEMO --> CORE
    DEMO --> EXPRESS

    style CORE fill:#4f46e5,color:#fff,stroke:#312e81
    style REDIS fill:#dc2626,color:#fff,stroke:#991b1b
    style EXPRESS fill:#059669,color:#fff,stroke:#065f46
    style FASTIFY fill:#059669,color:#fff,stroke:#065f46
    style TESTKIT fill:#9333ea,color:#fff,stroke:#6b21a8
    style DEMO fill:#6b7280,color:#fff,stroke:#374151
```

**Dependency rule:** Everything may depend on `core`; `core` depends on nothing; adapters never depend on each other. Enforced by `scripts/check-deps.ts`.

---

## Request Flow: `limiter.check()` → Decision

```mermaid
sequenceDiagram
    participant App as Application Code
    participant Lim as Limiter
    participant Store as Store (Memory / Redis)
    participant Algo as Algorithm.step()
    participant Lua as Lua Script (Redis only)
    participant Hook as Hooks (onDecision / onError)

    App->>Lim: check(key, { cost })
    Lim->>Lim: buildKey(prefix, algorithmId, key)

    alt Static config
        Lim->>Lim: use pre-validated config
    else Config resolver
        Lim->>Lim: await resolver(key)
        Lim->>Algo: parseConfig(raw)
    end

    Lim->>Store: consume(algorithm, fullKey, config, cost)

    alt MemoryStore
        Store->>Store: clock.nowMs()
        Store->>Algo: step(state, config, nowMs, cost)
        Algo-->>Store: { decision, nextState }
        Store->>Store: persist nextState + set TTL
    else RedisStore
        Store->>Lua: EVALSHA script, key, config, cost, [nowMs?]
        Note over Lua: Uses Redis TIME internally<br/>or explicit nowMs for testing
        Lua-->>Store: [allowed, limit, remaining, resetAtMs, retryAfterMs]
    end

    Store-->>Lim: Decision

    Lim->>Hook: onDecision({ key, decision, cost, durationMs })
    Note over Hook: Throwing hook is swallowed —<br/>never affects Decision

    Lim-->>App: Decision

    rect rgb(254, 226, 226)
        Note over Lim,Store: Store Error Path
        Store--xLim: throws StoreError
        Lim->>Lim: apply onStoreError policy
        alt fail-open (default)
            Lim->>Lim: synthetic Decision { allowed: true, degraded: true }
        else fail-closed
            Lim->>Lim: synthetic Decision { allowed: false, degraded: true }
        else custom handler
            Lim->>Lim: handler(error, context) → Decision { degraded: true }
        end
        Lim->>Hook: onError({ key, error, fallbackDecision })
        Lim->>Hook: onDecision({ key, decision: fallbackDecision, ... })
        Lim-->>App: fallback Decision
    end
```

---

## Core Principles

1. **Pure core, impure edges.** An algorithm is a pure, deterministic state-transition function: `(state | undefined, config, nowMs, cost) → (decision, nextState)`. No I/O, no `Date.now()`, no randomness.

2. **Atomicity belongs to the store.** Check-and-update must be atomic. MemoryStore runs `step()` synchronously. RedisStore runs equivalent Lua. Stores are NOT generic get/set adapters.

3. **The store owns the clock.** MemoryStore: injectable `Clock` (FakeClock in tests). RedisStore: `TIME` inside Lua. Lua scripts also accept optional explicit `nowMs` for deterministic testing.

4. **One truth, two executors.** Each algorithm exists as pure TS `step()` and as a Lua port. Conformance suites replay identical sequences against both, requiring identical decisions.

5. **Core is dependency-free and portable.** `@reqnx/core` has zero runtime dependencies and no `node:` imports. Runs on Node, Bun, Deno, edge runtimes.

6. **Fail explicitly.** Denied requests are normal return values, never exceptions. Store failures surface as `StoreError` handled by a configurable policy (default: fail-open).

---

## Key Schema

```
reqnx:{prefix}:{algorithmId}:{identity}
```

- **Max total key length:** 512 bytes
- **Long keys:** SHA-256 hashed (hex), prefixed with `h:`
- **MemoryStore:** configurable `maxKeys` cap (default 100,000) with random eviction
- **Redis:** per-identity state in ONE key (hash or sorted set) for Cluster safety

---

## State Versioning

Each algorithm declares `stateVersion: number`. When a store encounters state written by a different version, it resets the key instead of crashing. This enables safe rolling deploys.
