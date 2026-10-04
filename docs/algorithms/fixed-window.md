---
title: "Fixed Window Counter Algorithm"
summary: "Simplest, lowest-overhead rate limiter that divides time into non-overlapping epoch-aligned windows."
status: "implemented"
---

# Fixed Window Counter

The **Fixed Window Counter** algorithm is the simplest and highest-throughput rate-limiting strategy available in REQNX. It partitions the timeline into consecutive, non-overlapping windows of duration $W$ aligned to the Unix epoch. Each key is granted up to $L$ units of capacity per window. When a window expires, a fresh window begins immediately with full quota.

---

## How It Works

1. **Epoch Alignment**: The current window start is calculated deterministically from the current timestamp:
   $$\text{windowStart} = \lfloor \frac{\text{nowMs}}{\text{windowMs}} \rfloor \times \text{windowMs}$$
   Every server, container, and Redis node agrees on the exact millisecond boundaries of each window without distributed coordination.
2. **Admission Check**: When a request with cost $C$ arrives, the algorithm verifies whether:
   $$\text{currentCount} + C \le \text{limit}$$
3. **Non-Incrementing Denial**: If admitted, the counter increases by $C$. If denied, the counter **does not change**. Rejected requests never consume capacity.
4. **Window Expiry**: A request arriving at or after $\text{windowStart} + \text{windowMs}$ initiates a new window with $\text{count} = 0$.
5. **Backwards Clock Monotonicity**: If the system clock steps backwards (e.g. via NTP synchronization), the algorithm locks onto the stored window start and never resets quota early ([ADR-0002](file:///d:/zynorex%20Github/reqnx/docs/adr/0002-algorithm-contract-and-atomicity.md), [ADR-0010](file:///d:/zynorex%20Github/reqnx/docs/adr/0010-fixed-window-algorithm.md)).

---

## Configuration

```typescript
import { createLimiter, createMemoryStore, fixedWindow } from '@reqnx/core';

const limiter = createLimiter({
  algorithm: fixedWindow,
  store: createMemoryStore(),
  prefix: 'api',
  config: {
    limit: 100,      // Maximum allowed requests per window (1 to 2^31 - 1)
    window: '1m',    // Window duration (e.g. '10s', '1m', '1h', or milliseconds)
  },
});
```

### Config Validation Rules
- `limit`: Must be a safe positive integer between `1` and `2,147,483,647` ($2^{31} - 1$).
- `window`: String duration (e.g., `'500ms'`, `'10s'`, `'1m'`, `'2h'`) or integer milliseconds in `[1, 366 days]`.
- Unknown properties are strictly rejected with `ConfigError`.

---

## Decision Semantics

When `limiter.check()` executes, the returned `Decision` fields convey specific semantics for Fixed Window:

| Field | Type | Meaning in Fixed Window |
|---|---|---|
| `allowed` | `boolean` | `true` if $\text{count} + \text{cost} \le \text{limit}$; `false` otherwise. |
| `limit` | `number` | The configured window limit. |
| `remaining` | `number` | Remaining admitted capacity in the active window ($\text{limit} - \text{count}$). Minimum `0`. |
| `resetAtMs` | `number` | Epoch millisecond timestamp when the active window closes ($\text{windowStart} + \text{windowMs}$). |
| `retryAfterMs` | `number` | `0` when `allowed: true`. When denied, milliseconds remaining until window reset: $\max(1, \text{resetAtMs} - \text{nowMs})$. |
| `degraded` | `boolean` | `true` only if the backing store failed and fallback policy applied; `false` in normal operation. |

---

## The Boundary Burst (Double Capacity Phenomenon)

Because fixed window boundaries are rigid, a burst of traffic centered at a window boundary can admit twice the configured limit across a very short interval:

```
Window 1 [00:00 -> 01:00)           Window 2 [01:00 -> 02:00)
--------------------------|--------------------------
... [100 requests at 00:59.999] | [100 requests at 01:00.000] ...
--------------------------|--------------------------
                      Boundary (01:00)
```

In this scenario:
- 100 requests are admitted at $t = 59,999\text{ ms}$ (at the end of Window 1).
- 100 requests are admitted at $t = 60,000\text{ ms}$ (at the start of Window 2).
- **Result:** 200 requests are admitted in a 1 millisecond span, which is $2 \times \text{limit}$.

This behavior is intrinsic to fixed window algorithms and is verified by test:
[`documents intended behaviour: boundary burst admits 2x limit within 2 ms`](file:///d:/zynorex%20Github/reqnx/packages/core/src/__tests__/fixed-window.test.ts).

If your system cannot tolerate a $2\times$ boundary burst, use **Sliding Window Counter** or **Token Bucket** instead.

---

## When to Use and When Not to Use

### Recommended When:
- **Low latency and maximum throughput** are paramount (over 20 million pure ops/sec).
- **Memory footprint** must remain minimal (~273 bytes per key in Node.js V8 heap).
- The downstream service can absorb momentary bursts of up to $2 \times \text{limit}$ at window boundaries.
- Rate limits represent general usage quotas (e.g. 5,000 requests per hour per user).

### Not Recommended When:
- Spikes at boundary lines must be smoothed evenly (use **Token Bucket** or **Leaky Bucket**).
- Strict moving-window guarantees are required without double-limit bursts (use **Sliding Window Log** or **Sliding Window Counter**).

---

## Complexity & State Shape

- **Time Complexity**: $\mathcal{O}(1)$ for `step()`, `peek()`, and `stateTtlMs()`.
- **Space Complexity**: $\mathcal{O}(1)$ per key.
- **State Shape**:
  ```typescript
  interface FixedWindowState {
    readonly windowStart: number; // Epoch ms of window origin
    readonly count: number;       // Admitted request tokens in this window
  }
  ```
- **State Version**: `1`
- **State TTL**: Exactly `windowMs`. Once a window completes, state expires cleanly from storage.

---

## Related References

- [ADR-0010: Fixed Window Counter Algorithm](file:///d:/zynorex%20Github/reqnx/docs/adr/0010-fixed-window-algorithm.md)
- [Day 6 Redis Port Specification](file:///d:/zynorex%20Github/reqnx/docs/algorithms/fixed-window.redis-port.md)
- [Algorithm Test Suite](file:///d:/zynorex%20Github/reqnx/packages/core/src/__tests__/fixed-window.test.ts)
