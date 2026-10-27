---
title: "ADR-0024: State Encoding, Versioning, and Corrupt-State Policy"
description: "ADR-0024: State Encoding, Versioning, and Corrupt-State Policy documentation."
area: "design"
status: "available"
order: 24
---

<!-- @generated from docs/adr/0024-state-encoding-versioning-and-corrupt-state-policy.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0024</span>
      <div class="rx-adr-title">ADR-0024: State Encoding, Versioning, and Corrupt-State Policy</div>
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

A rate limiter's persistent state in Redis must handle software upgrades (schema evolution), accidental key collisions, and data corruption without risking security vulnerabilities (such as granting infinite quota on malformed state).

## Decision

1. **Explicit Version Tag**:
   Every state hash in Redis stores field `v: 1` corresponding to `algorithm.stateVersion`.
2. **Version Mismatch Policy**:
   - If a key contains an unexpected or future `stateVersion`, the script treats the state as absent, creating a fresh window/bucket.
   - Matches the behavior of `MemoryStore`.
3. **Corrupt State Policy**:
   - If `v == "1"`, but any state field (`ws`, `c`, `l`, `at`, `a`, `b`, etc.) cannot be parsed as a valid safe integer or is negative, the script returns `REQNX_CORRUPT_STATE`.
   - The store maps this to `StoreError` with code `REQNX_CORRUPT_STATE`, activating the limiter's configured `StoreErrorPolicy` (`fail-open`, `fail-closed`, or custom handler).
   - **Critical Security Invariant**: Corrupted state is NEVER silently reset to fresh capacity, preventing attackers from bypassing limits by injecting malformed data.

## Consequences

- Clean schema upgrades across rolling deployments.
- High resilience against silent data corruption and tampering.
