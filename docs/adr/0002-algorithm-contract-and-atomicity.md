# ADR-0002: Algorithm Contract & Atomicity Model

**Status:** Accepted  
**Date:** 2026-10-01

## Context

Rate-limiting algorithms need to check and update state atomically. A naive store interface (`get`/`set`/`incr`) can't provide this for Redis without WATCH/retry loops or transactions, which are slow and race-prone under load.

## Decision

### Algorithm as pure function

An algorithm implements the `Algorithm<Config, State>` interface:

```typescript
interface Algorithm<Config, State> {
  readonly id: AlgorithmId;
  readonly stateVersion: number;
  parseConfig(input: unknown): Config;
  step(
    state: State | undefined,
    config: Config,
    nowMs: number,
    cost: number,
  ): { decision: Decision; nextState: State };
  peek(state: State | undefined, config: Config, nowMs: number): Decision;
  stateTtlMs(config: Config): number;
}
```

**Purity contract:** `step()` and `peek()` must never perform I/O, call `Date.now()`, use `Math.random()`, or throw. All non-determinism is injected by the Store.

### Atomicity belongs to the Store

The `Store.consume()` method takes the full `Algorithm` object and executes the check-and-update atomically:

- **MemoryStore**: Calls `algorithm.step()` synchronously. Single-threaded Node.js guarantees no interleaving as long as there's no `await` between read and write.
- **RedisStore**: Runs an equivalent Lua script via `EVALSHA`. The algorithm's TS `step()` is never called — the Lua port is.

### State versioning

`Algorithm.stateVersion` is a monotonically increasing integer. When the store reads state written by a different version, it resets the key rather than crashing on a shape mismatch. This enables safe rolling deploys.

## Consequences

- Algorithms are trivially testable (pure functions, no mocking needed).
- New algorithms are easy to add: implement the interface, write a Lua port, add conformance tests.
- `Store` is not a generic adapter — it's an algorithm executor. This prevents the "leaky abstraction" of trying to make atomic rate limiting work over a key-value API.

## Alternatives Considered

- **Store as get/set/incr adapter**: Familiar pattern, but fundamentally can't be made atomic on Redis without WATCH/retry or transactions. Rejected.
- **Class-based algorithm hierarchy**: More ceremony, harder to test, no real benefit for stateless pure functions. Rejected in favor of plain objects + factory functions.
- **Store calls `step()` even for Redis**: Would require serialising the TS function, which is impossible. The Lua port is the only option for Redis atomicity.
