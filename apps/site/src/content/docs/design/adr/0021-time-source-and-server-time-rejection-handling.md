---
title: "ADR-0021: Time Source & Server TIME Rejection Handling"
description: "ADR-0021: Time Source & Server TIME Rejection Handling documentation."
area: "design"
status: "available"
order: 21
---

<!-- @generated from docs/adr/0021-time-source-and-server-time-rejection-handling.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0021</span>
      <div class="rx-adr-title">ADR-0021: Time Source & Server TIME Rejection Handling</div>
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

Distributed rate limiting requires agreement on time across application instances. Local system clocks suffer from NTP drift and leap second discrepancies. However, certain managed cloud environments (such as AWS ElastiCache Serverless in cluster mode) prohibit executing `redis.call('TIME')` inside Lua scripts for performance isolation.

## Decision

1. **Default (Server Authoritative Time)**:
   - Scripts read server time directly via `redis.call('TIME')` (`sec * 1000 + math.floor(usec / 1000)`).
   - Eliminates clock skew between distributed application instances.
2. **Explicit Clock Injection (`options.clock`)**:
   - When an explicit `Clock` is provided to `createRedisStore`, the store passes `clock.nowMs()` as `nowMsOverride` to all Lua scripts, overriding server time.
   - Enables 100% deterministic testing with `FakeClock`.
3. **Structured Server Rejection Handling**:
   - `redis.call('TIME')` is executed inside a `pcall`. If the Redis server or proxy rejects `TIME`, the script returns `REQNX_TIME_REJECTED`.
   - The store maps this to `StoreError` with code `REQNX_TIME_REJECTED` and an actionable remediation message:
     *"Redis server rejected TIME inside Lua script. Configure timeMode: 'pre-call' or provide an explicit synchronized Clock."*
4. **Pre-Call Time Mode (`timeMode: 'pre-call'`)**:
   - Fetches server time via a separate round-trip command prior to script execution and passes the timestamp into the script via `ARGV`.
   - Preserves server time authority in environments that block in-script `TIME` commands.

## Consequences

- Zero inter-node clock skew out of the box.
- Seamless compatibility with restricted cloud proxies without sacrificing consistency.
