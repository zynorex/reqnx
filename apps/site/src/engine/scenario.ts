// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Scenario Engine
//
// Drives interactive demos by running the REAL @reqnx/core library in the
// browser against a simulated clock. No mocks, no server calls.
// See ADR-0012.
// ──────────────────────────────────────────────────────────────────────────────

import { createMemoryStore, createLimiter, fixedWindow } from '@reqnx/core';
import type { Algorithm } from '@reqnx/core';
import { createBrowserFakeClock } from './fake-clock.js';
import type { ScenarioConfig, ScenarioStep, ScenarioResult } from './types.js';

/**
 * Resolve an algorithm by ID.
 *
 * Currently only fixed-window is available. As new algorithms are
 * implemented on subsequent days, add them here.
 */
function resolveAlgorithm(algorithmId: string): Algorithm<unknown, unknown> {
  switch (algorithmId) {
    case 'fixed-window':
      return fixedWindow as Algorithm<unknown, unknown>;
    default:
      throw new Error(`Unknown algorithm: ${algorithmId}`);
  }
}

export interface ScenarioEngine {
  /** Run all actions and return the full result. */
  runAll(): Promise<ScenarioResult>;
  /** Step through one action at a time (for animated playback). */
  step(): Promise<ScenarioStep | null>;
  /** Reset to initial state for re-run. */
  reset(): void;
  /** Whether all steps have been executed. */
  readonly done: boolean;
  /** Steps executed so far. */
  readonly steps: readonly ScenarioStep[];
  /** Current simulated time. */
  readonly currentMs: number;
}

/**
 * Create a scenario engine that runs real @reqnx/core in the browser.
 *
 * @param config - Scenario configuration (algorithm, config, actions).
 * @returns A ScenarioEngine for step-by-step or full playback.
 */
export function createScenarioEngine(config: ScenarioConfig): ScenarioEngine {
  const clock = createBrowserFakeClock(0);
  const algorithm = resolveAlgorithm(config.algorithmId);

  let store = createMemoryStore({ clock });
  let limiter = createLimiter({
    algorithm,
    store,
    prefix: 'demo',
    config: config.algorithmConfig,
  });

  let stepIndex = 0;
  let executedSteps: ScenarioStep[] = [];

  const engine: ScenarioEngine = {
    async runAll(): Promise<ScenarioResult> {
      while (!engine.done) {
        await engine.step();
      }
      return buildResult(executedSteps, clock.nowMs());
    },

    async step(): Promise<ScenarioStep | null> {
      if (stepIndex >= config.actions.length) return null;

      const action = config.actions[stepIndex]!;

      // Advance the simulated clock
      if (action.delayMs > 0) {
        clock.advance(action.delayMs);
      }

      const atMs = clock.nowMs();
      const decision = await limiter.check(action.key, {
        cost: action.cost ?? 1,
      });

      const step: ScenarioStep = {
        index: stepIndex,
        action,
        atMs,
        decision,
      };

      executedSteps.push(step);
      stepIndex++;

      return step;
    },

    reset(): void {
      clock.reset();
      // Recreate store and limiter for a clean slate
      void store.close();
      store = createMemoryStore({ clock });
      limiter = createLimiter({
        algorithm,
        store,
        prefix: 'demo',
        config: config.algorithmConfig,
      });
      stepIndex = 0;
      executedSteps = [];
    },

    get done(): boolean {
      return stepIndex >= config.actions.length;
    },

    get steps(): readonly ScenarioStep[] {
      return executedSteps;
    },

    get currentMs(): number {
      return clock.nowMs();
    },
  };

  return engine;
}

/** Build a final result summary from executed steps. */
function buildResult(steps: readonly ScenarioStep[], totalMs: number): ScenarioResult {
  let allowed = 0;
  let denied = 0;

  for (const step of steps) {
    if (step.decision.allowed) {
      allowed++;
    } else {
      denied++;
    }
  }

  return {
    steps,
    totalMs,
    summary: { allowed, denied, total: steps.length },
  };
}
