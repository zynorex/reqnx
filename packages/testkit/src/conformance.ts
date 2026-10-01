// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/testkit — Conformance suite types
//
// The conformance suite replays identical (time, cost) sequences against
// both the pure TS step() function and the Lua equivalent, asserting
// identical Decisions. Full implementation on Day 2-3.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type Decision, type Store } from '@reqnx/core';

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
 * Run a conformance suite against a store, verifying that the store
 * produces identical decisions to the pure TS step function for every
 * step in every test case.
 *
 * @param algorithm - The algorithm under test.
 * @param store     - The store to test (MemoryStore or RedisStore).
 * @param cases     - The conformance test cases.
 *
 * @example
 * ```ts
 * // In a vitest file:
 * runConformanceSuite(fixedWindow, memoryStore, fixedWindowCases);
 * ```
 */
export function runConformanceSuite<Config, State>(
  _algorithm: Algorithm<Config, State>,
  _store: Store,
  _cases: readonly ConformanceCase<Config>[],
): void {
  // TODO: implement on Day 2-3
  throw new Error('Not implemented');
}
