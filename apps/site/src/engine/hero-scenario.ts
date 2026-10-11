// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Hero Looping Scenario
//
// Deterministic 10-second scenario demonstrating Fixed Window rate limiting:
// 1. Steady requests within limit (allowed)
// 2. Burst hitting capacity (allowed -> 0 remaining)
// 3. Excess requests denied with precise retryAfterMs (denied)
// 4. Window rollover reset (recovered to full capacity)
//
// Verified by apps/site/tests/hero-loop.test.ts
// ──────────────────────────────────────────────────────────────────────────────

import type { ScenarioConfig } from './types.js';

export const HERO_CONFIG = {
  algorithmId: 'fixed-window' as const,
  algorithmConfig: {
    limit: 5,
    window: '4s', // 4,000 ms window
  },
  windowMs: 4000,
  limit: 5,
  loopDurationMs: 10000,
} as const;

export const heroScenarioConfig: ScenarioConfig = {
  algorithmId: HERO_CONFIG.algorithmId,
  algorithmConfig: HERO_CONFIG.algorithmConfig,
  actions: [
    // Window 1 (0ms - 4000ms): Steady requests
    { delayMs: 400, key: 'client-1' }, // t=400ms: allowed, rem 4
    { delayMs: 1000, key: 'client-1' }, // t=1400ms: allowed, rem 3
    { delayMs: 1000, key: 'client-1' }, // t=2400ms: allowed, rem 2
    { delayMs: 400, key: 'client-1' }, // t=2800ms: allowed, rem 1
    { delayMs: 400, key: 'client-1' }, // t=3200ms: allowed, rem 0 (limit reached)

    // Window 1: Over-limit requests (Denied)
    { delayMs: 300, key: 'client-1' }, // t=3500ms: DENIED (retryAfter ~500ms)
    { delayMs: 300, key: 'client-1' }, // t=3800ms: DENIED (retryAfter ~200ms)

    // Window 2 (4000ms - 8000ms): Rollover & Recovery
    { delayMs: 600, key: 'client-1' }, // t=4400ms: allowed, rem 4 (recovered)
    { delayMs: 1200, key: 'client-1' }, // t=5600ms: allowed, rem 3
    { delayMs: 1600, key: 'client-1' }, // t=7200ms: allowed, rem 2

    // Window 3 (8000ms - 12000ms): Rollover
    { delayMs: 1200, key: 'client-1' }, // t=8400ms: allowed, rem 4
  ],
};
