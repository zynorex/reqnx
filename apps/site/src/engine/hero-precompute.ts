// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Pre-computed Hero State for Zero-CLS Static Render
//
// Computes initial frame of the LiveConsole at build time so no-JS visitors
// and initial paint see real @reqnx/core output without layout shift.
// ──────────────────────────────────────────────────────────────────────────────

import { createScenarioEngine } from './scenario.js';
import { heroScenarioConfig, HERO_CONFIG } from './hero-scenario.js';
import type { ScenarioStep } from './types.js';

export interface PrecomputedHeroState {
  readonly currentMs: number;
  readonly windowMs: number;
  readonly limit: number;
  readonly steps: readonly ScenarioStep[];
  readonly latestStep: ScenarioStep;
}

/**
 * Pre-computes the initial hero state at t=3,500ms (showing 5 allowed and 1 denied request).
 */
export async function getPrecomputedHeroState(): Promise<PrecomputedHeroState> {
  const engine = createScenarioEngine(heroScenarioConfig);

  // Step 0: t=400ms (allowed)
  // Step 1: t=1400ms (allowed)
  // Step 2: t=2400ms (allowed)
  // Step 3: t=2800ms (allowed)
  // Step 4: t=3200ms (allowed, rem 0)
  // Step 5: t=3500ms (denied, retryAfter 500ms)
  for (let i = 0; i <= 5; i++) {
    await engine.step();
  }

  const steps = [...engine.steps];
  const latestStep = steps[steps.length - 1];

  return {
    currentMs: engine.currentMs,
    windowMs: HERO_CONFIG.windowMs,
    limit: HERO_CONFIG.limit,
    steps,
    latestStep,
  };
}
