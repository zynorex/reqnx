// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Hero Scenario Determinism Tests
//
// Verifies that the Hero LiveConsole scenario runs deterministically against
// real @reqnx/core, producing verified decisions at exact millisecond offsets.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createScenarioEngine } from '../src/engine/scenario.js';
import { heroScenarioConfig, HERO_CONFIG } from '../src/engine/hero-scenario.js';
import { getPrecomputedHeroState } from '../src/engine/hero-precompute.js';

describe('Hero Scenario Determinism', () => {
  it('executes the golden 10-second sequence through real @reqnx/core', async () => {
    const engine = createScenarioEngine(heroScenarioConfig);
    const result = await engine.runAll();

    expect(result.steps.length).toBe(11);
    expect(result.steps[0].decision.limit).toBe(5);

    // Step 0: t=400ms -> allowed, rem 4
    expect(result.steps[0].atMs).toBe(400);
    expect(result.steps[0].decision.allowed).toBe(true);
    expect(result.steps[0].decision.remaining).toBe(4);

    // Step 4: t=3200ms -> allowed, rem 0 (exhausted limit)
    expect(result.steps[4].atMs).toBe(3200);
    expect(result.steps[4].decision.allowed).toBe(true);
    expect(result.steps[4].decision.remaining).toBe(0);

    // Step 5: t=3500ms -> DENIED (first denial)
    expect(result.steps[5].atMs).toBe(3500);
    expect(result.steps[5].decision.allowed).toBe(false);
    expect(result.steps[5].decision.remaining).toBe(0);
    expect(result.steps[5].decision.retryAfterMs).toBe(500);

    // Step 6: t=3800ms -> DENIED (second denial)
    expect(result.steps[6].atMs).toBe(3800);
    expect(result.steps[6].decision.allowed).toBe(false);
    expect(result.steps[6].decision.remaining).toBe(0);
    expect(result.steps[6].decision.retryAfterMs).toBe(200);

    // Step 7: t=4400ms -> Window 2 reset! ALLOWED, rem 4
    expect(result.steps[7].atMs).toBe(4400);
    expect(result.steps[7].decision.allowed).toBe(true);
    expect(result.steps[7].decision.remaining).toBe(4);

    // Summary checks
    expect(result.summary.allowed).toBe(9);
    expect(result.summary.denied).toBe(2);
    expect(result.summary.total).toBe(11);
  });

  it('precomputes initial static frame at t=3500ms for zero-CLS paint', async () => {
    const precomputed = await getPrecomputedHeroState();

    expect(precomputed.currentMs).toBe(3500);
    expect(precomputed.windowMs).toBe(HERO_CONFIG.windowMs);
    expect(precomputed.limit).toBe(HERO_CONFIG.limit);
    expect(precomputed.steps.length).toBe(6);

    // Initial frame shows 5 allowed and 1 denied
    const allowed = precomputed.steps.filter((s) => s.decision.allowed);
    const denied = precomputed.steps.filter((s) => !s.decision.allowed);
    expect(allowed.length).toBe(5);
    expect(denied.length).toBe(1);

    // Latest step is the denial
    expect(precomputed.latestStep.decision.allowed).toBe(false);
    expect(precomputed.latestStep.decision.retryAfterMs).toBe(500);
  });
});
