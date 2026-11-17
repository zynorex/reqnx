---
title: "ADR-0028: Leaky Bucket Queue & Shaper Variant (Deferred to Day 9)"
description: "ADR-0028: Leaky Bucket Queue & Shaper Variant (Deferred to Day 9) documentation."
area: "design"
status: "available"
order: 28
---

<!-- @generated from docs/adr/0028-leaky-bucket-queue-and-shaper-variant.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0028</span>
      <div class="rx-adr-title">ADR-0028: Leaky Bucket Queue & Shaper Variant (Deferred to Day 9)</div>
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

## Status

Accepted (Proposed for Day 9)

## Context

While the Leaky Bucket meter (shipped in Day 7 via [ADR-0027](/design/adr/0027-leaky-bucket-meter-and-token-bucket-equivalence/)) polices traffic by immediately dropping requests that exceed capacity, a **traffic shaper (or queue variant)** delays or queues excess requests so that outgoing traffic leaves at a strictly smooth, uniform rate.

Implementing a true shaper requires capabilities fundamentally different from an immediate `check(key)` call that returns a synchronous `{ allowed: boolean }` `Decision`.

## Analysis of Requirements for Traffic Shaping

1. **Reservation vs Immediate Admission**:
   - An immediate decision cannot shape traffic.
   - A shaper must support a `reserve(key, cost)` operation: it commits future capacity on a timeline (typically via Generic Cell Rate Algorithm / GCRA with Theoretical Arrival Time `TAT`) and returns `{ delayMs: number }`.
2. **Caller-Side Waiting vs Process Blocking**:
   - If the limiter blocks the Node.js event loop with `sleep(delayMs)`, high concurrency quickly exhausts Node event loop memory and violates REQNX's timer-free purity in `@reqnx/core`.
   - Therefore, waiting must be caller-side (or integrated into middleware adapters in Day 8 / Day 9), where the caller awaits an asynchronous delay before dispatching upstream work.
3. **Queue Bounding & Memory Safety**:
   - Without an upper limit on queue depth or max delay, queuing requests during sustained overload leads to unbounded memory growth and timeout cascades.
   - A shaper requires a configured `maxDelayMs` or `maxQueueDepth`. If the computed delay exceeds `maxDelayMs`, the request must drop immediately rather than waiting.
4. **Cancellation and Connection Drops**:
   - If an HTTP client disconnects while waiting in queue, the reserved slot is already committed on Redis. Mechanisms to cancel or roll back reservations add significant distributed coordination overhead.

## Decision

1. **Defer Shaper Implementation to Day 9**:
   - Do not alter the core `Store` or `Algorithm` contracts on Day 7.
   - Keep `@reqnx/core` focused on pure synchronous step functions returning allow/deny `Decision` objects.
2. **Proposed Day 9 Design**:
   - Introduce a `Shaper` / `Reserver` capability:
     ```ts
     interface Reservation {
       readonly admittedAtMs: number;
       readonly delayMs: number;
       readonly drop: boolean;
     }
     ```
   - Implement via GCRA (tracking single `tatMs` timestamp per key in Redis).
   - Middleware adapters (Express/Fastify) can optionally sleep for `delayMs` if `delayMs <= maxDelayMs`, or return HTTP 429 immediately.

## Consequences

- Keeps Day 7 clean, strictly maintaining zero contract changes to `Store`, `Limiter`, `Decision`, or `@reqnx/testkit`.
- Prevents uncoordinated architectural bloat while documenting a clear, principled path forward for Day 9.
