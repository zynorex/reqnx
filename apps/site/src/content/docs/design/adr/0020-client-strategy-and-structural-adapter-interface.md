---
title: "ADR-0020: Client Strategy & Structural Adapter Interface"
description: "ADR-0020: Client Strategy & Structural Adapter Interface documentation."
area: "design"
status: "available"
order: 20
---

<!-- @generated from docs/adr/0020-client-strategy-and-structural-adapter-interface.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0020</span>
      <div class="rx-adr-title">ADR-0020: Client Strategy & Structural Adapter Interface</div>
    </div>
    <span class="rx-adr-status rx-adr-accepted">
      <span class="rx-status-dot"></span>
      Accepted
    </span>
  </div>
  <div class="rx-adr-meta-grid">
    <div class="rx-meta-item">
      <span class="rx-meta-label">Status</span>
      <span class="rx-meta-value">Accepted</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Decision Date</span>
      <span class="rx-meta-value">2026-10</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Deciders</span>
      <span class="rx-meta-value">REQNX Architecture Team</span>
    </div>
  </div>
</div>

## Context

Day 1 initially chose `ioredis` as the default client. Since then, modern Redis documentation highlights that `ioredis` maintenance is best-effort and officially recommends `node-redis` for new Node.js deployments. Furthermore, tying `@reqnx/redis` to any concrete client library forces unwanted dependencies onto consumers who may already have their own connection pool or Redis Cluster configuration.

## Decision

1. **Zero Runtime Dependencies**: `@reqnx/redis` has zero mandatory runtime dependencies.
2. **Minimal Structural Client Interface**: Define `RedisClientAdapter` specifying only the required primitives:
   - `evalSha(sha, keys, args)`
   - `eval(script, keys, args)`
   - `unlink(key)`
   - `pttl?(key)`
   - `scriptLoad?(script)`
   - `time?()`
   - `isClosed()`
   - `isConnected?()`
   - `close()`
3. **Dual Optional Adapters**:
   - `@reqnx/redis/node-redis`: primary adapter wrapping `node-redis` (peer dep `redis: "^4.7.0 || ^5.0.0"`).
   - `@reqnx/redis/ioredis`: adapter wrapping `ioredis` (peer dep `ioredis: "^5.0.0"`).
4. **Connection Lifecycle Ownership**:
   - An adapter instance passed to `createRedisStore({ client })` is caller-owned and never closed by the store.
   - A connection URL string passed to `createRedisStore({ client: 'redis://...' })` is store-owned and closed when `store.close()` is invoked.
   - Operations invoked on closed clients fail immediately with structured `StoreError` (`REQNX_CLIENT_CLOSED`).

## Consequences

- Consumers choose their preferred client driver with zero package bloat.
- Eliminates lock-in and enables seamless support for custom enterprise wrappers and connection proxies.
