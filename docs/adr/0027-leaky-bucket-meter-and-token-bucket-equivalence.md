# ADR-0027: Leaky Bucket Meter & Token Bucket Equivalence

## Status

Accepted

## Context

The fifth rate-limiting algorithm requested in the REQNX roadmap is the Leaky Bucket. In computer networking, the leaky bucket algorithm exists in two distinct variants:
1. **As a meter (policer)**: Requests add water to an accumulator. If adding water exceeds the bucket capacity, the request is immediately dropped (denied). Water leaks out at a continuous rate over time.
2. **As a queue (shaper)**: Requests enter a FIFO queue and are held (delayed) until they leak out at a constant, regular rate.

Because REQNX rate limiters operate on synchronous request paths returning an immediate allow/deny `Decision`, the meter variant is the natural fit for Day 7.

Mathematically, a leaky bucket meter and a token bucket are dual formulations of the exact same continuous state machine:
- Token bucket: Available permits start at maximum $\text{capacity}$ and refill over time.
- Leaky bucket: Accumulated water starts at $0$ and leaks down to empty over time.

For equivalent parameters ($\text{capacity}$, $\text{leak} = \text{refillTokens}$, $\text{interval} = \text{refillInterval}$), both machines make **100% identical allow and deny decisions**, have identical remaining room, and identical retry and reset times.

## Decision

1. **Ship `leakyBucket` as a Meter**:
   - Provide `leakyBucket` with algorithm ID `'leaky-bucket'` and domain-specific water vocabulary: `{ capacity, leak, interval, leakInterval }`.
   - Decision fields:
     - `limit`: Maximum bucket capacity.
     - `remaining`: Whole units of room available in the bucket ($\text{capacity} - \text{waterLevel}$).
     - `resetAtMs`: Epoch timestamp when the bucket will be completely empty (drained).
     - `retryAfterMs`: $0$ if allowed; exact milliseconds until enough water leaks to fit `cost` if denied.
2. **Delegate Arithmetic to Token Bucket Engine**:
   - Implement `leakyBucket` by converting `LeakyBucketConfig` into the equivalent `TokenBucketConfig` and delegating to `tokenBucket.step` and `tokenBucket.peek`.
   - Guarantees zero logic duplication, zero floating-point drift, and inherits all safe-integer bounds proofs ([ADR-0014](file:///d:/zynorex%20Github/reqnx/docs/adr/0014-token-bucket-algorithm.md), [ADR-0025](file:///d:/zynorex%20Github/reqnx/docs/adr/0025-lua-integer-numerics-and-precision-proofs.md)).
3. **Prove Equivalence by Automated Tests**:
   - Verify equivalence across 1,000+ randomized sequences via `fast-check` in `leaky-bucket.test.ts`.
   - Maintain an independent discrete water-model oracle simulating ms-by-ms water accumulation and leaking.
   - Run comparison scenarios in `scripts/compare-algorithms.ts` generating `docs/algorithms/comparison.md`, verified by `packages/core/src/__tests__/comparison.test.ts`.
4. **Reuse Redis Lua Script via PortRegistry**:
   - `leakyBucketRedisPort` reuses `TOKEN_BUCKET_CONSUME_SCRIPT` and `TOKEN_BUCKET_PEEK_SCRIPT` with mapped arguments, loading zero duplicate Lua code into Redis.
   - Key schema strictly isolates storage: `reqnx:{prefix}:leaky-bucket:{identity}` vs `reqnx:{prefix}:token-bucket:{identity}`.

## Consequences

- Full support for users thinking in the water reservoir metaphor without introducing duplicate arithmetic bugs.
- 100% test coverage and mathematically proven equivalence.
- Zero extra memory or script cache footprint on Redis.
