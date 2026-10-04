// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Scenario engine types
// ──────────────────────────────────────────────────────────────────────────────

import type { AlgorithmId, Decision } from '@reqnx/core';

/** A single action in a scenario timeline. */
export interface ScenarioAction {
  /** Milliseconds to advance the simulated clock before this action. */
  readonly delayMs: number;
  /** Identity key (e.g. "user-1"). */
  readonly key: string;
  /** Cost of this request. @default 1 */
  readonly cost?: number;
}

/** Configuration for a scenario run. */
export interface ScenarioConfig {
  /** Algorithm to use (looked up from features registry). */
  readonly algorithmId: AlgorithmId;
  /** Raw algorithm config (e.g. { limit: 5, window: '10s' }). */
  readonly algorithmConfig: unknown;
  /** Ordered list of actions to replay. */
  readonly actions: readonly ScenarioAction[];
}

/** Result of a single step in the scenario. */
export interface ScenarioStep {
  /** 0-based index in the action list. */
  readonly index: number;
  /** The action that was executed. */
  readonly action: ScenarioAction;
  /** Simulated clock time (ms) when this action ran. */
  readonly atMs: number;
  /** Decision returned by the real library. */
  readonly decision: Decision;
}

/** Result of a complete scenario run. */
export interface ScenarioResult {
  /** All steps, in order. */
  readonly steps: readonly ScenarioStep[];
  /** Total simulated time elapsed (ms). */
  readonly totalMs: number;
  /** Summary counts. */
  readonly summary: {
    readonly allowed: number;
    readonly denied: number;
    readonly total: number;
  };
}
