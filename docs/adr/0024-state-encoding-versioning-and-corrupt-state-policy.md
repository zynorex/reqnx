# ADR-0024: State Encoding, Versioning, and Corrupt-State Policy

## Status

Accepted

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
