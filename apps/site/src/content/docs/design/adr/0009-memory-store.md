---
title: "ADR-0009: MemoryStore Architecture and Eviction Policy"
description: "ADR-0009: MemoryStore Architecture and Eviction Policy documentation."
area: "design"
status: "available"
order: 9
---

<!-- @generated from docs/adr/0009-memory-store.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0009</span>
      <div class="rx-adr-title">ADR-0009: MemoryStore Architecture and Eviction Policy</div>
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

`@reqnx/core` requires a zero-dependency, in-process store implementation (`MemoryStore`) that:

1. Guarantees synchronous atomicity without race conditions.
2. Manages memory footprint under high traffic and key-enumeration attacks.
3. Cleans up expired state without relying on long-running background timers (which break on serverless/edge runtimes and complicate deterministic testing).
4. Provides predictable eviction behavior when memory capacity is reached.

## Decision

### 1. Synchronous Atomicity

Node.js processes run on a single-threaded event loop. `MemoryStore.consume()` calls `algorithm.step()` synchronously without any intervening `await` between reading and writing state. This provides strict race-free atomicity for concurrent operations within the process.

### 2. Eviction Policy: LRU via Doubly-Linked List + Map

`MemoryStore` implements an O(1) Least-Recently-Used (LRU) eviction policy using a doubly-linked list paired with a JavaScript `Map`:

- Each entry holds `{ state, version, expiresAtMs, lruNode }`.
- Successful `consume()` promotes the entry to the head of the LRU list.
- `peek()` is pure and does not promote in LRU order or modify state.
- When `entries.size >= maxKeys` (default: 100,000) and a new key is inserted, `MemoryStore` first runs an incremental sweep of expired entries. If still at capacity, it evicts the least-recently-used entry from the tail.

### 3. Incremental Sweeping without Timers

Rather than using `setInterval()` (which prevents processes from exiting cleanly, fails on edge runtimes, and complicates deterministic FakeClock testing), `MemoryStore` uses bounded incremental sweeping:

- Every `sweepIntervalOps` operations (default: 1,000 calls to `consume`, `peek`, or `reset`), an incremental sweep inspects at most `sweepBatchSize` entries (default: 500) and purges expired ones.
- Expired entries are also lazily purged upon read access (`readState()`).
- Operators can trigger an explicit full sweep via `store.sweep()`.

### 4. Cardinality Attack Mitigation

Evicting an active key before its rate-limit window expires effectively resets that identity's usage, potentially granting an attacker a fresh quota.

- Operators should configure `maxKeys` according to anticipated concurrent active identities.
- Operators can monitor `store.stats().evictions` for abnormal eviction spikes.
- For high-cardinality distributed deployments, `RedisStore` should be used.

## Consequences

- Zero external runtime dependencies.
- Completely deterministic behavior under `FakeClock`.
- Fully portable to Node.js, Cloudflare Workers, Vercel Edge, Deno, and Bun.
- Amortized O(1) for `consume`, `peek`, and `reset`.
