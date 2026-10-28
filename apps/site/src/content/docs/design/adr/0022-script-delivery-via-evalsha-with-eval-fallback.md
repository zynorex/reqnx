---
title: "ADR-0022: Script Delivery via EVALSHA with EVAL Fallback"
description: "ADR-0022: Script Delivery via EVALSHA with EVAL Fallback documentation."
area: "design"
status: "available"
order: 22
---

<!-- @generated from docs/adr/0022-script-delivery-via-evalsha-with-eval-fallback.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0022</span>
      <div class="rx-adr-title">ADR-0022: Script Delivery via EVALSHA with EVAL Fallback</div>
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

Executing Lua scripts over the network requires choosing between raw `EVAL`, cached `EVALSHA`, and Redis 7 Functions (`FUNCTION LOAD`). Redis script caches are volatile (cleared on failover, restart, or `SCRIPT FLUSH`). Redis Functions are persistent, but require elevated administrative permissions and deployment-time lifecycle orchestration that rate-limiting library consumers often lack.

## Decision

1. **Self-Healing `EVALSHA` with `EVAL` Fallback**:
   - Precompute 40-character hexadecimal SHA1 hashes locally in TypeScript via `crypto.createHash('sha1')`.
   - Execute scripts via `EVALSHA`.
   - On `NOSCRIPT` error, transparently catch and execute `EVAL` with the full script string (which automatically recompiles and populates the Redis script cache).
   - Subsequent calls resume using `EVALSHA` with zero runtime intervention.
2. **Script Warmup API (`store.warmup()`)**:
   - Optional method to execute `SCRIPT LOAD` across all registered algorithms upon startup or reconnection to avoid first-call `EVAL` overhead.
3. **Deferral of Redis Functions**:
   - Redis Functions require cluster-wide replication coordination and administrative ACL privileges that are inappropriate for an unprivileged rate limiting library.

## Consequences

- Completely self-healing under Redis failover, restarts, or maintenance flushes.
- Zero configuration, zero administrative setup required.
