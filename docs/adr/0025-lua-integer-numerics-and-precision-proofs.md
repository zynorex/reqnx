# ADR-0025: Lua Integer Numerics & Precision Proofs

## Status

Accepted

## Context

Lua 5.1 in Redis uses standard IEEE 754 64-bit double-precision floating point numbers for numeric values. The maximum safe integer without precision loss in double precision is $2^{53} - 1 = 9,007,199,254,740,991$. Intermediate operations (such as token bucket refill multiplications or timestamp calculations) must never exceed this boundary.

## Decision

1. **Exact Rational Representation**:
   - Rates are represented as coprime integer pairs $(a, b)$ where $\text{rate} = a/b$ units per millisecond.
   - 1 token equals $b$ internal units; total capacity is $\text{capacityUnits} = \text{capacity} \times b$.
2. **Intermediate Bound Proof**:
   - Algorithm input validation enforces $\text{capacityUnits} \le 2^{51} \approx 2.25 \times 10^{15}$.
   - Token bucket refill addition:
     $$\text{total} \le 2 \times \text{capacityUnits} + a \le 2 \times 2^{51} + (2^{31} - 1) = 2^{52} + 2,147,483,647 \approx 4.505 \times 10^{15} \ll 2^{53} - 1$$
   - Since $4.505 \times 10^{15} < 9.007 \times 10^{15}$, intermediate arithmetic is provably exact with zero precision loss.
3. **Integer Division Helpers with Correction Steps**:
   - `div_floor(a, b)`: computes floor division with correction step ensuring exact integer quotient.
   - `div_ceil(a, b)`: computes ceiling division with correction step ensuring exact integer quotient.
4. **No String Coercion on Large Numbers**:
   - Numbers greater than 14 digits are never converted using `tostring` or string concatenation to avoid scientific notation formatting.

## Consequences

- 100% exact, deterministic numeric transitions between TypeScript and Redis Lua.
- Zero floating-point drift over arbitrary time spans.
