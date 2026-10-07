---
title: 'Token Bucket Rate-Limiting Algorithm'
summary: 'Continuous token replenishment algorithm supporting burst capacity with exact rational refill rates and zero float drift.'
status: 'implemented'
---

# Token Bucket Algorithm

The **Token Bucket** algorithm is an industry-standard rate-limiting strategy that allows bursty traffic while enforcing a smooth long-term throughput ceiling. Tokens accumulate in a bucket of fixed `capacity` at a constant rational rate (`refillTokens` per `refillInterval`). Incoming requests consume tokens from the bucket; if sufficient tokens are available, the request is admitted. If the bucket is exhausted, requests are denied until tokens replenish.

REQNX implements Token Bucket using **pure integer fixed-point arithmetic** with GCD rate normalisation. It guarantees zero floating-point drift, exact millisecond replenishment, and strictly bounded memory usage.

---

## How It Works

1. **Continuous Refill**: Tokens replenish smoothly over time. Rather than relying on periodic background timers or ticker intervals, the algorithm computes accumulated tokens lazily on each request based on elapsed time:
   $$\text{elapsed} = \max(\text{nowMs}, \text{state.at}) - \text{state.at}$$
2. **Exact Rational Representation ($a/b$)**:
   The refill rate is normalised into coprime integers:
   $$g = \gcd(\text{refillTokens}, \text{intervalMs}), \quad a = \frac{\text{refillTokens}}{g}, \quad b = \frac{\text{intervalMs}}{g}$$
   - Internal state is tracked in units of $\frac{1}{b}$ token.
   - Maximum capacity is $\text{capacityUnits} = \text{capacity} \times b$.
   - Each elapsed millisecond adds exactly $a$ internal units.
   - One whole token costs exactly $b$ internal units.
3. **Admission & Non-Writing Denial**:
   - When a request requires `cost` tokens, it needs $\text{need} = \text{cost} \times b$ units.
   - If $\text{refilled} \ge \text{need}$, the request is admitted, $\text{need}$ is deducted, and `at` is updated to the current evaluation instant.
   - If $\text{refilled} < \text{need}$, the request is **denied**, and the stored state is **left completely unchanged**. Denied requests never write to storage, never extend TTL, and never starve replenishment.
4. **Backwards Clock Monotonicity ([ADR-0002](file:///d:/zynorex%20Github/reqnx/docs/adr/0002-algorithm-contract-and-atomicity.md), [ADR-0014](file:///d:/zynorex%20Github/reqnx/docs/adr/0014-token-bucket-algorithm.md))**:
   If system time moves backwards (e.g. NTP synchronization corrections), $\text{effectiveNow} = \max(\text{nowMs}, \text{state.at})$. No negative refill occurs, state timestamp never regresses, and the limiter never grants spurious tokens.

---

## Configuration & Sizing Guide

```typescript
import { createLimiter, createMemoryStore, tokenBucket } from '@reqnx/core';

const limiter = createLimiter({
  algorithm: tokenBucket,
  store: createMemoryStore(),
  prefix: 'api',
  config: {
    capacity: 20, // Maximum burst capacity (1 to 2^31 - 1)
    refillTokens: 5, // Tokens refilled per interval
    refillInterval: '1s', // Refill interval duration (e.g. '1s', '100ms')
  },
});
```

### Config Validation Rules

- `capacity`: Safe positive integer in $[1, 2^{31} - 1]$. Represents maximum bucket depth and maximum single-request burst.
- `refillTokens`: Safe positive integer in $[1, 2^{31} - 1]$.
- `refillInterval`: Valid `Duration` string (e.g. `'100ms'`, `'1s'`, `'1m'`) or positive integer milliseconds ($\le 366$ days).
- **Safe Unit Bound**: $\text{capacityUnits} = \text{capacity} \times b \le 2^{51}$. Proves that all intermediate calculations remain strictly within IEEE 754 safe integer limits ($2^{53} - 1$).
- **Full Refill Cap**: $\text{fullRefillMs} = \lceil \frac{\text{capacityUnits}}{a} \rceil \le 366\text{ days}$.

### Sizing Worked Examples

| Use Case                        | Recommended Config                                              | Behaviour                                                                   |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Standard REST API**           | `{ capacity: 50, refillTokens: 10, refillInterval: '1s' }`      | Allows bursts up to 50 requests; refills steadily at 10 requests/sec.       |
| **High-Frequency Microservice** | `{ capacity: 500, refillTokens: 100, refillInterval: '100ms' }` | Sustains 1,000 req/sec with instantaneous headroom for 500-request spikes.  |
| **Strict Webhook Dispatcher**   | `{ capacity: 5, refillTokens: 1, refillInterval: '5s' }`        | Emits at most 1 event every 5 seconds, allowing small queues of 5 to clear. |

---

## Decision Semantics

When `limiter.check()` executes, the returned `Decision` conveys exact semantics for Token Bucket:

| Field          | Type      | Meaning in Token Bucket                                                                                                                                                                 |
| -------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowed`      | `boolean` | `true` if $\text{refilled} \ge \text{cost} \times b$; `false` otherwise.                                                                                                                |
| `limit`        | `number`  | Configured maximum burst capacity (`capacity`).                                                                                                                                         |
| `remaining`    | `number`  | Whole tokens available now after check: $\lfloor \frac{\text{levelAfter}}{b} \rfloor$.                                                                                                  |
| `resetAtMs`    | `number`  | Epoch millisecond when the bucket will be completely full ($\text{effectiveNow} + \lceil \frac{\text{capacityUnits} - \text{levelAfter}}{a} \rceil$).                                   |
| `retryAfterMs` | `number`  | `0` when `allowed: true`. When denied, exact milliseconds until required tokens refill: $(\text{effectiveNow} + \lceil \frac{\text{need} - \text{refilled}}{a} \rceil) - \text{nowMs}$. |
| `degraded`     | `boolean` | `true` only if backing store failed and fallback policy applied; `false` in normal operation.                                                                                           |

### Retry-After Exactness

The `retryAfterMs` value is **exact to the millisecond**:

- Retrying at `nowMs + retryAfterMs` is mathematically guaranteed to succeed (assuming no intervening traffic).
- Retrying at `nowMs + retryAfterMs - 1` is guaranteed to fail.

---

## Burst Dynamics & Comparison with Fixed Window

### Worst-Case Burst

In any continuous time window of duration $T$, the maximum number of admissions admitted is bounded by:
$$\text{Max Admissions}(T) = \text{capacity} + \lfloor \frac{T \times a}{b} \rfloor$$

### Token Bucket vs Fixed Window

| Aspect                 | Fixed Window Counter                                                 | Token Bucket                                                         |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Boundary Bursting**  | Vulnerable to $2 \times \text{limit}$ burst across window boundaries | **Immune**: burst is strictly capped at `capacity` over any interval |
| **Post-Idle Burst**    | Adits up to `limit` immediately                                      | Admits up to `capacity` immediately                                  |
| **Pacing / Smoothing** | Traffic can bunch at start of every window                           | Refills steadily; paces continuous traffic smoothly                  |
| **State Footprint**    | 2 numbers (`windowStart`, `count`)                                   | 4 numbers (`level`, `at`, `a`, `b`)                                  |
| **Complexity**         | 1 modulo division                                                    | GCD normalisation + fixed-point multiplication                       |

---

## Dynamic Configuration Changes

When limits change dynamically via `ConfigResolver`:

- **Capacity Decrease**: If existing token level exceeds the new capacity, `level` clamps immediately to `newCapacity`.
- **Capacity Increase**: Does **not** grant immediate free tokens. Existing tokens are retained; additional tokens must replenish at the configured rate.
- **Rate Change**: Tokens written under an old rate $(a_{\text{old}}, b_{\text{old}})$ are converted conservatively using whole tokens only:
  $$\text{wholeTokens} = \min(\lfloor \frac{\text{state.level}}{b_{\text{old}}} \rfloor, \text{newCapacity}), \quad \text{level} = \text{wholeTokens} \times b_{\text{new}}$$
  Fractional units are dropped to prevent free tokens during rate switching.

---

## When to Use Token Bucket

### Recommended For:

- Public-facing APIs requiring protection against traffic spikes while permitting legitimate short bursts.
- Microservice RPC endpoints where downstream systems can handle short queues.
- Webhooks and third-party rate limits defined in terms of rate and burst depth.

### Not Recommended For:

- Hard monthly or daily quotas tied strictly to calendar boundaries (use [Fixed Window](file:///d:/zynorex%20Github/reqnx/docs/algorithms/fixed-window.md) or Sliding Window Counter).
- Strictly uniform inter-arrival spacing without any burst allowance (use Leaky Bucket / GCRA).

---

## Implementation Details

- **Purity**: Zero I/O, zero `Date.now()`, zero `Math.random()`. Deterministic pure state transitions.
- **Source Code**: [`packages/core/src/algorithms/token-bucket.ts`](file:///d:/zynorex%20Github/reqnx/packages/core/src/algorithms/token-bucket.ts)
- **Unit Tests**: [`packages/core/src/__tests__/token-bucket.test.ts`](file:///d:/zynorex%20Github/reqnx/packages/core/src/__tests__/token-bucket.test.ts)
- **Model Oracle Tests**: [`packages/core/src/__tests__/token-bucket.model.test.ts`](file:///d:/zynorex%20Github/reqnx/packages/core/src/__tests__/token-bucket.model.test.ts)
- **Property Tests**: [`packages/core/src/__tests__/token-bucket.properties.test.ts`](file:///d:/zynorex%20Github/reqnx/packages/core/src/__tests__/token-bucket.properties.test.ts)
- **Architecture Record**: [ADR-0014: Token Bucket Algorithm](file:///d:/zynorex%20Github/reqnx/docs/adr/0014-token-bucket-algorithm.md)
