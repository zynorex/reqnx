# ADR-0014: Token Bucket Algorithm Design and Exact Rational Arithmetic

## Status

Accepted

## Date

2026-10-07

## Context

Token Bucket is the second rate-limiting algorithm implemented in REQNX. Unlike Fixed Window Counter ([ADR-0010](file:///d:/zynorex%20Github/reqnx/docs/adr/0010-fixed-window-algorithm.md)), Token Bucket supports continuous replenishment, fractional refill progress, and burst absorption without window boundary doubling.

However, naive token bucket implementations in other libraries suffer from significant flaws:

1. **Floating-point drift**: Representing rates as `tokensPerSecond = tokens / interval` introduces IEEE 754 float representation inaccuracy and cumulative precision drift over time.
2. **Cardinality and TTL misalignment**: Evicting active keys before a bucket refills grants spurious full bursts upon re-creation.
3. **Integer overflow on idle buckets**: Multiplying huge elapsed durations by the rate can overflow 64-bit integer registers or IEEE 754 safe integers.
4. **Probing and denial writes**: Mutating timestamps on rejected requests starves legitimate refills and extends storage TTL indefinitely.

This ADR resolves the architectural decisions, rate representation, arithmetic bounds, and state transition semantics for the Token Bucket algorithm.

---

## Decisions

### 1. Configuration Schema: `{ capacity, refillTokens, refillInterval }`

- **Keys**: `capacity` (positive safe integer $\le 2^{31} - 1$), `refillTokens` (positive safe integer $\le 2^{31} - 1$), `refillInterval` (string duration or positive integer ms).
- **Rejected Alternative (Floats)**: Floats (e.g. `{ refillRate: 0.3333 }`) are banned across the entire codebase. Float arithmetic causes rounding divergence between V8 JavaScript, edge runtimes, and Redis Lua 5.1 doubles.
- **Rejected Alternative (GCRA / Theoretical Arrival Time)**: Generic Cell Rate Algorithm stores a single arrival timestamp $TAT$ but introduces complex non-linear scaling for multi-token costs and unintuitive remaining/resetAt semantics compared to classic token bucket.

### 2. Exact Rational Fixed-Point Arithmetic ($a/b$)

All rates are pre-normalised in TypeScript using the Euclidean greatest common divisor:
$$g = \gcd(\text{refillTokens}, \text{intervalMs}), \quad a = \frac{\text{refillTokens}}{g}, \quad b = \frac{\text{intervalMs}}{g}$$

- The rate is exactly $\frac{a}{b}$ tokens per millisecond.
- Internal state is tracked in integer units of $\frac{1}{b}$ token.
- $\text{capacityUnits} = \text{capacity} \times b$.
- Each elapsed millisecond adds $a$ units. One token costs $b$ units.
- **Equivalence guarantee**: `"10 per 1s"` and `"1 per 100ms"` reduce to identical $(a, b) = (1, 100)$ and produce mathematically identical state transitions.

### 3. Safe Integer Bounds Proof ($\text{capacityUnits} \le 2^{51}$)

- Configurations are rejected at validation if $\text{capacityUnits} > 2^{51} = 2,251,799,813,685,248$.
- When calculating refills:
  $$\text{elapsed}_{\text{clamped}} = \min(\text{elapsed}, \text{fullRefillMs}), \quad \text{where } \text{fullRefillMs} = \lceil \frac{\text{capacityUnits}}{a} \rceil$$
- The maximum possible intermediate sum is:
  $$\text{level} + \text{elapsed}_{\text{clamped}} \times a \le 2 \times \text{capacityUnits} + a \le 2 \times 2^{51} + (2^{31} - 1) = 2^{52} + 2,147,483,647 \approx 4.505 \times 10^{15}$$
- This value is strictly below the IEEE 754 safe integer limit:
  $$2^{52} + 2^{31} - 1 \ll 2^{53} - 1 = 9,007,199,254,740,991$$
- Clamping `elapsed` to `fullRefillMs` _before_ multiplying ensures that intermediate products never overflow safe integer bounds, even if a key has been idle for $10^{16}$ milliseconds.

### 4. Fresh Bucket Starts Full

A fresh bucket begins with $\text{level} = \text{capacityUnits}$ at $\text{nowMs}$.

- **Rationale**: New clients immediately receive their burst allocation.
- **Cold-Start Burst**: Documented in sizing guides; clients wishing to pace traffic steadily should set `capacity = 1` or use Leaky Bucket.

### 5. Decision Field Semantics

- `remaining = Math.floor(levelAfter / b)`: Only whole tokens are reported. Fractional progress is preserved in `level` but not rounded up.
- `resetAtMs = effectiveNow + ceil((capacityUnits - levelAfter) / a)`: The exact timestamp when the bucket will be completely full.
- `retryAfterMs`: `0` if admitted. If denied: $(\text{effectiveNow} + \lceil \frac{\text{need} - \text{refilled}}{a} \rceil) - \text{nowMs}$. Retrying at `nowMs + retryAfterMs` is exact and succeeds.

### 6. Backwards Clock Monotonicity

If the clock steps backwards:
$$\text{effectiveNow} = \max(\text{nowMs}, \text{state.at})$$

- Elapsed time is evaluated as $\text{effectiveNow} - \text{state.at} \ge 0$.
- No negative refill occurs, state `at` never moves backwards, and `retryAfterMs` automatically accounts for backwards delta $(\text{state.at} - \text{nowMs})$.

### 7. Denied Requests Do Not Write State

If $\text{refilled} < \text{need}$, `allowed = false` and `nextState = state`.

- **Rationale**: Writing on denial would advance `at` and starve continuous replenishment. Furthermore, storage TTL is not extended on denied requests.

### 8. `cost > capacity` Handled at the Top of `step()`

If `cost > capacity`, the request can never be satisfied. Handled before calculating $\text{cost} \times b$ to protect against safe integer overflow when `cost = Number.MAX_SAFE_INTEGER`. Returns `retryAfterMs` based on time to full refill.

### 9. Dynamic Config Changes

- **Capacity decrease**: Clamps existing level to `newCapacityUnits`.
- **Capacity increase**: Does not grant tokens instantly; retains existing tokens.
- **Rate change**: Converts conservatively using whole tokens only: $\min(\lfloor \frac{\text{level}}{b_{\text{old}}} \rfloor, \text{capacity}) \times b_{\text{new}}$.

---

## Consequences

- Pure integer arithmetic guaranteed across Node.js, edge workers, and Redis Lua 5.1.
- Exact millisecond precision with zero floating-point accumulation errors.
- Single-key storage footprint: 4 numerical fields (`l`, `at`, `a`, `b`) amounting to ~295 bytes per key in V8 heap.
- Lua porting on Day 6 is mechanical and requires zero mathematical adaptation.
