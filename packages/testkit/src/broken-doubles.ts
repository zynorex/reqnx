// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/testkit — Broken test doubles for negative control tests
//
// These doubles intentionally violate REQNX contracts to verify that
// conformance and contract test suites catch non-compliant implementations.
// ──────────────────────────────────────────────────────────────────────────────

import {
  type Algorithm,
  type AlgorithmId,
  type Clock,
  type Decision,
  type Store,
  SystemClock,
} from '@reqnx/core';

/**
 * A deliberately non-atomic store.
 * Yields the event loop with `await Promise.resolve()` between read and write,
 * causing race conditions when accessed concurrently.
 */
export function createNonAtomicStore(): Store {
  const map = new Map<string, { state: unknown }>();

  return {
    id: 'broken-non-atomic',
    async consume<C, S>(
      algorithm: Algorithm<C, S>,
      key: string,
      config: C,
      cost: number,
    ): Promise<Decision> {
      // READ state
      const current = map.get(key);

      // DELIBERATE BREACH OF ATOMICITY: yield event loop
      await Promise.resolve();

      // STEP
      const result = algorithm.step(
        current?.state as S | undefined,
        config,
        performance.now(),
        cost,
      );

      // WRITE state
      map.set(key, { state: result.nextState });

      return result.decision;
    },

    async peek<C, S>(algorithm: Algorithm<C, S>, key: string, config: C): Promise<Decision> {
      const current = map.get(key);
      return algorithm.peek(current?.state as S | undefined, config, performance.now());
    },

    async reset(key: string): Promise<void> {
      map.delete(key);
    },

    async close(): Promise<void> {
      map.clear();
    },
  };
}

/**
 * A store that deliberately ignores TTL and never expires any state.
 */
export function createNoTtlStore(clock: Clock = SystemClock): Store {
  const map = new Map<string, { state: unknown }>();

  return {
    id: 'broken-no-ttl',
    async consume<C, S>(
      algorithm: Algorithm<C, S>,
      key: string,
      config: C,
      cost: number,
    ): Promise<Decision> {
      const current = map.get(key);
      const nowMs = clock.nowMs();
      // Ignores TTL: always feeds existing state regardless of nowMs
      const result = algorithm.step(current?.state as S | undefined, config, nowMs, cost);
      map.set(key, { state: result.nextState });
      return result.decision;
    },

    async peek<C, S>(algorithm: Algorithm<C, S>, key: string, config: C): Promise<Decision> {
      const current = map.get(key);
      return algorithm.peek(current?.state as S | undefined, config, clock.nowMs());
    },

    async reset(key: string): Promise<void> {
      map.delete(key);
    },

    async close(): Promise<void> {
      map.clear();
    },
  };
}

/**
 * An algorithm that becomes MORE generous when the clock moves backwards.
 * E.g., if nowMs < state.lastNowMs, it resets its limit or allows the request.
 */
export function createBackwardsClockGenerousAlgorithm(): Algorithm<
  { limit: number },
  { count: number; lastNowMs: number }
> {
  return {
    id: 'counter' as unknown as AlgorithmId,
    stateVersion: 1,

    parseConfig(raw: unknown): { limit: number } {
      if (typeof raw === 'object' && raw !== null && 'limit' in raw) {
        const limitVal = (raw as Record<string, unknown>)['limit'];
        if (typeof limitVal === 'number') {
          return { limit: limitVal };
        }
      }
      return { limit: 10 };
    },

    step(state, config, nowMs, cost) {
      // DELIBERATE FLAW: if time moved backwards, reset counter and allow!
      if (state && nowMs < state.lastNowMs) {
        return {
          decision: {
            allowed: true,
            limit: config.limit,
            remaining: config.limit - cost,
            resetAtMs: nowMs + 1000,
            retryAfterMs: 0,
            degraded: false,
          },
          nextState: { count: cost, lastNowMs: nowMs },
        };
      }

      const count = (state?.count ?? 0) + cost;
      const allowed = count <= config.limit;
      return {
        decision: {
          allowed,
          limit: config.limit,
          remaining: Math.max(0, config.limit - count),
          resetAtMs: nowMs + 1000,
          retryAfterMs: allowed ? 0 : 1000,
          degraded: false,
        },
        nextState: { count, lastNowMs: nowMs },
      };
    },

    peek(state, config, nowMs) {
      const count = state?.count ?? 0;
      return {
        allowed: count < config.limit,
        limit: config.limit,
        remaining: Math.max(0, config.limit - count),
        resetAtMs: nowMs + 1000,
        retryAfterMs: 0,
        degraded: false,
      };
    },

    stateTtlMs() {
      return 1000;
    },
  };
}
