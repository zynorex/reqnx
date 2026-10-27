---
title: "ADR-0026: Redis Test Strategy & TTL Neutralisation"
description: "ADR-0026: Redis Test Strategy & TTL Neutralisation documentation."
area: "design"
status: "available"
order: 26
---

<!-- @generated from docs/adr/0026-redis-test-strategy-and-ttl-neutralisation.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0026</span>
      <div class="rx-adr-title">ADR-0026: Redis Test Strategy & TTL Neutralisation</div>
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

Testing distributed Redis Lua scripts against pure TypeScript state transition functions requires reconciling virtual clock simulation with real Redis server time and physical key expiration. Advancing a virtual `FakeClock` by 10 minutes in a test will not expire a key on a real Redis server unless 10 real minutes elapse or the server daemon itself is manipulated.

## Decision

1. **Differential Replay with Injected Clock**:
   - Differential testing feeds identical sequences of $(advanceMs, cost)$ steps to both the pure TypeScript algorithm and the `RedisStore`.
   - `RedisStore` accepts an explicit `Clock` option, injecting deterministic timestamps via script `ARGV`.
2. **TTL Neutralisation for Differential Step Testing**:
   - During differential step replay, algorithms are wrapped to return an elongated `stateTtlMs` (e.g. 24 hours).
   - This ensures simulated clock advances do not prematurely expire keys via real server wall-clock time between steps.
3. **Dedicated Real TTL Verification Suite (`ttl.test.ts`)**:
   - Real server key expiration is asserted separately using Redis `PTTL` commands.
   - Verifies that `PTTL` strictly matches `windowMs`, `fullRefillMs`, or `2 * windowMs`.
   - Verifies that denied requests and peek probes do not create keys or refresh TTL.
4. **Testkit StoreHarness Capabilities**:
   - `StoreHarness` in `@reqnx/testkit` introduces `capabilities: { simulatedTtl?: boolean }`.
   - Allows remote server stores to declare that virtual clock steps do not advance physical server expiration without failing contract suites.

## Consequences

- 100% deterministic, ultra-fast differential testing (300 fast-check sequences execute in seconds).
- Complete isolation between algorithmic step correctness and physical Redis expiration verification.
