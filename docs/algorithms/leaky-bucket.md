---
title: 'Leaky Bucket Rate-Limiting Algorithm (Meter)'
summary: 'Continuous water-drain metering algorithm enforcing smooth throughput ceilings and burst limits with exact rational leak rates.'
status: 'implemented'
---

# Leaky Bucket Algorithm (Meter)

The **Leaky Bucket (as a meter)** is a classic network rate-limiting algorithm based on a water reservoir metaphor. The bucket has a finite maximum `capacity`. When requests arrive, they add water equivalent to their `cost`. Water leaks continuously out of the bottom of the bucket at an exact rational rate (`leak` units per `interval`). If adding a request's cost would overflow the bucket, the request is immediately denied, and the water level is left untouched.

In REQNX, the Leaky Bucket is implemented as a **meter** (traffic policer). It returns an immediate allow or deny `Decision`. True traffic shaping (holding or queuing requests until water leaks) is deferred to the queue/shaper variant detailed in [ADR-0028](file:///d:/zynorex%20Github/reqnx/docs/adr/0028-leaky-bucket-queue-and-shaper-variant.md).

---

## The Water Metaphor vs Token Bucket Duality

The Leaky Bucket meter and Token Bucket are **mathematically dual state machines** ([ADR-0027](file:///d:/zynorex%20Github/reqnx/docs/adr/0027-leaky-bucket-meter-and-token-bucket-equivalence.md)). For equivalent configuration parameters:
$$\text{capacity}_{\text{leaky}} = \text{capacity}_{\text{token}}, \quad \text{leak} = \text{refillTokens}, \quad \text{interval} = \text{refillInterval}$$

They make **100% identical allow and deny decisions**, calculate the same `remaining` capacity, and compute the exact same `resetAtMs` and `retryAfterMs`:

| Concept | Token Bucket | Leaky Bucket (Meter) |
|---|---|---|
| **Underlying State** | Available permits (starts FULL) | Accumulated water (starts EMPTY) |
| **Request Cost** | Deducts permits: $\text{tokens} - \text{cost}$ | Adds water: $\text{water} + \text{cost}$ |
| **Denial Condition** | Not enough permits: $\text{tokens} < \text{cost}$ | Overflow: $\text{water} + \text{cost} > \text{capacity}$ |
| **Background Rate** | Adds permits at refill rate | Leaks water at drain rate |
| **Remaining Room** | Whole permits: $\lfloor\text{tokens} / b\rfloor$ | Available room: $\lfloor(\text{capacityUnits} - \text{water}) / b\rfloor$ |
| **Reset Instant** | When bucket is full of tokens | When bucket is empty of water |

REQNX leverages this exact mathematical equivalence by delegating internal arithmetic to the proven, battle-tested `tokenBucket` integer engine, eliminating duplicate logic and preventing floating-point drift.

---

## The Curve-1 Case: Strict Rate Metering (No Bursts)

When `capacity` is configured to match the request cost (e.g. `capacity: 1`, `leak: 1`, `interval: '1s'`), the meter permits **at most one admission per interval with zero bursts**:

```ts
import { createLimiter, createMemoryStore, leakyBucket } from '@reqnx/core';

const limiter = createLimiter({
  algorithm: leakyBucket,
  store: createMemoryStore(),
  prefix: 'strict-meter',
  config: { capacity: 1, leak: 1, interval: '100ms' },
});

// t = 0ms: First request consumes capacity 1 -> allowed (remaining: 0, reset: 100ms)
const d1 = await limiter.check('client-1'); // allowed: true

// t = 10ms: Immediate second request -> DENIED (bucket is full, retryAfterMs: 90ms)
const d2 = await limiter.check('client-1'); // allowed: false

// t = 100ms: Exactly 100ms elapsed, 1 unit has leaked -> allowed!
const d3 = await limiter.check('client-1'); // allowed: true
```

---

## Configuration Reference

```ts
export interface LeakyBucketInput {
  /** Maximum volume the bucket can hold. Safe integer in [1, 2^31 - 1]. */
  readonly capacity: number;
  /** Amount of water that leaks per interval. Safe integer in [1, 2^31 - 1]. */
  readonly leak: number;
  /** Duration between leaks. Milliseconds or string (e.g. '1s', '500ms'). */
  readonly interval?: Duration;
  /** Ergonomic alias for interval. */
  readonly leakInterval?: Duration;
}
```

### Decision Semantics
- `limit`: The configured maximum bucket volume (`capacity`).
- `remaining`: Whole units of room remaining in the bucket (`capacity - waterLevel`).
- `resetAtMs`: Epoch timestamp when the bucket will completely drain to empty.
- `retryAfterMs`: `0` if allowed; exact milliseconds until enough water leaks to fit `cost` if denied.
