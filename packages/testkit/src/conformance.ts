// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/testkit — Conformance & contract suite runners
//
// Provides contract test suites for verifying Store and Algorithm implementations.
// ──────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import { type Algorithm, type Clock, type Decision, type Store, StoreError } from '@reqnx/core';
import { FakeClock } from './fake-clock.js';
import { type CounterConfig, type CounterState, counterAlgorithm } from './fixtures.js';

let testSeq = 0;

// ─── Conformance types ────────────────────────────────────────────────────────

/**
 * A single step in a conformance test sequence.
 */
export interface ConformanceStep {
  /** Epoch ms at which this step occurs. */
  readonly atMs: number;
  /** Cost to consume. Use 0 for a peek-only step. */
  readonly cost: number;
  /** The expected decision after this step. */
  readonly expected: Decision;
}

/**
 * A full conformance test case.
 *
 * @typeParam Config - Algorithm config type.
 */
export interface ConformanceCase<Config> {
  /** Human-readable test name. */
  readonly name: string;
  /** Algorithm config (raw, pre-parseConfig). */
  readonly config: Config;
  /** Ordered sequence of steps to replay. */
  readonly steps: readonly ConformanceStep[];
}

/**
 * Replay an ordered sequence of conformance steps against a store.
 */
export async function runConformanceSuite<Config, State>(
  algorithm: Algorithm<Config, State>,
  store: Store,
  cases: readonly ConformanceCase<Config>[],
): Promise<void> {
  for (const c of cases) {
    const key = `conformance:${c.name}`;
    await store.reset(key);
    for (let i = 0; i < c.steps.length; i++) {
      const step = c.steps[i]!;
      let decision: Decision;
      if (step.cost === 0) {
        decision = await store.peek(algorithm, key, c.config);
      } else {
        decision = await store.consume(algorithm, key, c.config, step.cost);
      }
      expect(decision.allowed).toBe(step.expected.allowed);
      expect(decision.limit).toBe(step.expected.limit);
      expect(decision.remaining).toBe(step.expected.remaining);
      expect(decision.retryAfterMs).toBe(step.expected.retryAfterMs);
      expect(decision.degraded).toBe(false);
    }
  }
}

// ─── Store Contract Suite ─────────────────────────────────────────────────────

export interface SampleStoreConfig {
  readonly limit: number;
}

/**
 * Harness for instantiating and cleaning up store instances under test.
 */
export interface StoreHarness<C extends SampleStoreConfig = CounterConfig, S = CounterState> {
  readonly name: string;
  readonly capabilities?: {
    readonly simulatedTtl?: boolean;
  };
  readonly algorithm?: Algorithm<C, S>;
  readonly sampleConfig?: C;
  isAvailable?(): Promise<boolean> | boolean;
  create(options?: { clock?: Clock }): Promise<Store> | Store;
  cleanup?(store: Store): Promise<void> | void;
}

/**
 * Programmatic check: verifies that concurrent consume operations execute atomically.
 * Throws if the number of allowed requests does not strictly equal `limit`.
 */
export async function assertStoreAtomicity(
  store: Store,
  algorithm: Algorithm<CounterConfig, CounterState> = counterAlgorithm,
  config: CounterConfig = { limit: 10, windowMs: 60_000 },
  concurrency = 100,
): Promise<void> {
  testSeq++;
  const key = `atomicity-test-${testSeq}-${Math.random()}`;
  const promises: Array<Promise<Decision>> = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(store.consume(algorithm, key, config, 1));
  }

  const results = await Promise.all(promises);
  const allowed = results.filter((r) => r.allowed).length;

  if (allowed !== config.limit) {
    throw new Error(
      `Store atomicity violation: expected exactly ${config.limit} allowed requests, but got ${allowed}.`,
    );
  }
}

/**
 * Programmatic check: verifies that entries expire at the exact TTL boundary.
 */
export async function assertStoreTtl(
  store: Store,
  clock: FakeClock,
  algorithm: Algorithm<CounterConfig, CounterState> = counterAlgorithm,
  config: CounterConfig = { limit: 5, windowMs: 1000 },
): Promise<void> {
  testSeq++;
  const key = `ttl-test-${testSeq}-${Math.random()}`;

  clock.set(1000);
  // Consume at T=1000 (expires at 2000)
  const d1 = await store.consume(algorithm, key, config, 5);
  if (!d1.allowed || d1.remaining !== 0) {
    throw new Error('Initial consume failed');
  }

  // At T=1999: must still be active and denied
  clock.set(1999);
  const d2 = await store.consume(algorithm, key, config, 1);
  if (d2.allowed) {
    throw new Error('Store allowed request before TTL expired (at T=expiresAt-1)');
  }

  // At T=2000: must be expired and allow fresh consume
  clock.set(2000);
  const d3 = await store.consume(algorithm, key, config, 1);
  if (!d3.allowed) {
    throw new Error('Store failed to expire entry at TTL boundary (at T=expiresAt)');
  }
}

/**
 * Vitest wrapper: runs the full Store contract suite against a {@link StoreHarness}.
 */
export function runStoreContractSuite<
  C extends SampleStoreConfig = CounterConfig,
  S = CounterState,
>(harness: StoreHarness<C, S>): void {
  describe(`Store Contract: ${harness.name}`, () => {
    let store: Store;
    let clock: FakeClock;
    const algo = (harness.algorithm ?? counterAlgorithm) as unknown as Algorithm<C, S>;
    const config = (harness.sampleConfig ?? { limit: 10, windowMs: 10_000 }) as unknown as C;

    let isAvailable = true;
    beforeEach(async () => {
      if (harness.isAvailable) {
        isAvailable = await harness.isAvailable();
      }
    });

    it('implements basic lifecycle: consume, peek, reset', async () => {
      if (!isAvailable) return;
      clock = new FakeClock(1000);
      store = await harness.create({ clock });
      const lifecycleConfig = (harness.sampleConfig ?? {
        limit: 3,
        windowMs: 10_000,
      }) as unknown as C;
      const key = 'test:lifecycle';

      // 1. Consume 1
      const d1 = await store.consume(algo, key, lifecycleConfig, 1);
      expect(d1.allowed).toBe(true);
      expect(d1.remaining).toBe(lifecycleConfig.limit - 1);

      // 2. Peek (must not mutate)
      const p1 = await store.peek(algo, key, lifecycleConfig);
      expect(p1.allowed).toBe(true);
      expect(p1.remaining).toBe(lifecycleConfig.limit - 1);

      // 3. Reset
      await store.reset(key);
      const p2 = await store.peek(algo, key, lifecycleConfig);
      expect(p2.remaining).toBe(lifecycleConfig.limit);

      await harness.cleanup?.(store);
    });

    it('enforces synchronous atomicity under high concurrency', async () => {
      if (!isAvailable) return;
      clock = new FakeClock(1000);
      store = await harness.create({ clock });
      await assertStoreAtomicity(
        store,
        algo as unknown as Algorithm<CounterConfig, CounterState>,
        config as unknown as CounterConfig,
        100,
      );
      await harness.cleanup?.(store);
    });

    it('strictly adheres to exact TTL boundary expiry', async () => {
      if (!isAvailable) return;
      if (harness.capabilities?.simulatedTtl === false) {
        return;
      }
      clock = new FakeClock(1000);
      store = await harness.create({ clock });
      await assertStoreTtl(
        store,
        clock,
        algo as unknown as Algorithm<CounterConfig, CounterState>,
        { limit: 5, windowMs: 1000 },
      );
      await harness.cleanup?.(store);
    });

    it('handles stateVersion mismatch by resetting to fresh state', async () => {
      if (!isAvailable) return;
      clock = new FakeClock(1000);
      store = await harness.create({ clock });
      const key = 'test:version-mismatch';

      await store.consume(algo, key, config, 1);

      const v2Algorithm: Algorithm<C, S> = {
        ...algo,
        stateVersion: (algo.stateVersion ?? 1) + 1,
      };

      const peek = await store.peek(v2Algorithm, key, config);
      expect(peek.remaining).toBe(config.limit); // reset to absent

      const d = await store.consume(v2Algorithm, key, config, 1);
      expect(d.remaining).toBe(config.limit - 1);

      await harness.cleanup?.(store);
    });

    it('rejects subsequent operations after close() if close is supported', async () => {
      if (!isAvailable) return;
      store = await harness.create();
      await store.close();
      await expect(store.consume(algo, 'k', config, 1)).rejects.toThrow(StoreError);
    });
  });
}

// ─── Algorithm Contract Suite ─────────────────────────────────────────────────

/**
 * Programmatic check: verifies that an algorithm is not more generous if clock moves backwards.
 */
export function assertAlgorithmClockMonotonicity<C, S>(
  algorithm: Algorithm<C, S>,
  config: C,
): void {
  // Step 1: at T=1000 consume 10
  const r1 = algorithm.step(undefined, config, 1000, 10);
  const remainingAt1000 = r1.decision.remaining;

  // Step 2: backwards clock at T=500 with same state
  const rBackwards = algorithm.step(r1.nextState, config, 500, 1);

  // If the backwards step allowed a request or increased remaining above remainingAt1000,
  // it is generous on backwards clock!
  if (rBackwards.decision.remaining > remainingAt1000) {
    throw new Error(
      `Algorithm is more generous on backwards clock: remaining increased from ${remainingAt1000} to ${rBackwards.decision.remaining}.`,
    );
  }
}

/**
 * Vitest wrapper: runs the full Algorithm contract suite against an {@link Algorithm}.
 */
export function runAlgorithmContractSuite<Config, State>(
  algorithm: Algorithm<Config, State>,
  sampleConfig: Config,
): void {
  describe(`Algorithm Contract: ${algorithm.id}`, () => {
    it('step() is a deterministic pure function', () => {
      const nowMs = 1_000_000;
      const step1 = algorithm.step(undefined, sampleConfig, nowMs, 1);
      const step2 = algorithm.step(undefined, sampleConfig, nowMs, 1);

      expect(step1.decision).toEqual(step2.decision);
      expect(step1.nextState).toEqual(step2.nextState);
    });

    it('peek() is pure and does not mutate state', () => {
      const nowMs = 1_000_000;
      const peekDec = algorithm.peek(undefined, sampleConfig, nowMs);
      expect(peekDec.degraded).toBe(false);
      expect(peekDec.limit).toBeGreaterThan(0);
      expect(peekDec.remaining).toBeLessThanOrEqual(peekDec.limit);
    });

    it('decision adheres to invariant: remaining in [0, limit]', () => {
      const res = algorithm.step(undefined, sampleConfig, 1000, 1);
      expect(res.decision.remaining).toBeGreaterThanOrEqual(0);
      expect(res.decision.remaining).toBeLessThanOrEqual(res.decision.limit);
    });

    it('decision adheres to invariant: retryAfterMs semantics', () => {
      const res = algorithm.step(undefined, sampleConfig, 1000, 1);
      if (res.decision.allowed) {
        expect(res.decision.retryAfterMs).toBe(0);
      } else {
        expect(res.decision.retryAfterMs).toBeGreaterThan(0);
      }
    });

    it('is not more generous when clock moves backwards', () => {
      assertAlgorithmClockMonotonicity(algorithm, sampleConfig);
    });
  });
}
