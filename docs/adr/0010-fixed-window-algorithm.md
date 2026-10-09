# ADR-0010: Fixed Window Counter Algorithm

## Status

Accepted

## Context

Fixed Window Counter is the simplest and lowest-overhead rate-limiting algorithm in REQNX. Before implementing it and later porting it to Redis/Lua on Day 6, six key semantics and design decisions needed formal resolution:

1. Window alignment strategy (epoch-aligned vs first-request-anchored).
2. Monotonicity policy on backwards clock drift (NTP corrections).
3. `peek()` probe semantics.
4. Maximum allowable limit value (`limit` cap).
5. State mutation on denied requests (whether denied requests consume capacity).
6. Enforcement location for requests where `cost > limit`.

## Decisions

### 1. Epoch-aligned windows

Windows are aligned strictly to the Unix epoch:
$$\text{windowStart} = \lfloor \frac{\text{nowMs}}{\text{windowMs}} \rfloor \times \text{windowMs}$$

- **Rationale:** Epoch alignment guarantees that every independent client, process, and distributed node agrees on window boundaries deterministically without coordinating a "window start" timestamp across instances.
- **Trade-off:** Boundary synchronization (the "boundary burst" or thundering-herd effect): up to $2 \times \text{limit}$ requests can be admitted across a 2 ms boundary spanning $W - 1$ and $W$. Applications that cannot tolerate this burst should select Sliding Window Counter (Day 5) or Token Bucket (Day 4).

### 2. Backwards clock monotonicity (ADR-0002 compliance)

If `nowMs` maps to an aligned window strictly earlier than `state.windowStart`, the algorithm clamps to the stored window:
$$\text{windowStart} = \text{state.windowStart}, \quad \text{count} = \text{state.count}$$

- **Rationale:** Under backwards clock drift (e.g. NTP stepping backward), the rate limiter must never become more generous or grant early quota renewals.

### 3. `peek()` semantics

`peek(state, config, nowMs)` calculates remaining quota without state modification. `allowed` is true if and only if a request with `cost = 1` would succeed (`count + 1 <= limit`). `retryAfterMs` is 0 if allowed, or $\max(1, \text{windowEnd} - \text{nowMs})$ if exhausted.

### 4. Limit cap: $2^{31} - 1$

`limit` must be a positive safe integer within $[1, 2^{31} - 1]$ (i.e. $1 \le \text{limit} \le 2,147,483,647$).

- **Rationale:** Standard 32-bit signed integer boundary ensures uniform arithmetic precision across JavaScript V8 numbers and Redis Lua 5.1/5.2 double-precision floating point representations without overflow or precision loss.

### 5. Denied requests do not increment the counter

If $\text{count} + \text{cost} > \text{limit}$, `allowed = false` and `nextState = state`.

- **Rationale:** Many naive Redis implementations use `INCRBY` before checking the limit, which permanently consumes tokens even for rejected requests and allows probing attacks to exhaust a victim's quota. REQNX records only _admitted_ cost. The Day 6 Lua script will strictly mirror this behavior.

### 6. `cost > limit` handled inside `step()`

When a request has `cost > limit`, `count + cost <= limit` evaluates to `false` for any non-negative `count`. The request is denied cleanly with `remaining = limit - count`, `retryAfterMs = max(1, windowEnd - nowMs)`, and zero state change, even for `cost = Number.MAX_SAFE_INTEGER`.

## Consequences

- Single-counter state representation: `{ windowStart: number, count: number }`.
- Memory footprint is bounded and compact (~273 bytes per key in Node.js V8 heap).
- Zero runtime dependencies in `@reqnx/core`.
- Day 6 Redis/Lua script requirements are strictly specified and bounded.
