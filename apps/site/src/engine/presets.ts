// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Built-in scenario presets
//
// Each preset is a ScenarioConfig that demonstrates a specific behaviour
// of the algorithm. Presets are used by the playground and algorithm pages.
// ──────────────────────────────────────────────────────────────────────────────

import type { ScenarioConfig } from './types.js';

/**
 * Basic burst: 7 requests in rapid succession against a limit of 5.
 * Demonstrates that requests 6 and 7 are denied.
 */
export const fixedWindowBurst: ScenarioConfig = {
  algorithmId: 'fixed-window',
  algorithmConfig: { limit: 5, window: '10s' },
  actions: [
    { delayMs: 0, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    // These two should be denied
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
  ],
};

/**
 * Window rollover: 5 requests, then wait for the window to reset, then 3 more.
 * All 8 requests should be allowed.
 */
export const fixedWindowRollover: ScenarioConfig = {
  algorithmId: 'fixed-window',
  algorithmConfig: { limit: 5, window: '10s' },
  actions: [
    { delayMs: 0, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    // Wait for window to reset
    { delayMs: 10_000, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
  ],
};

/**
 * Boundary burst: exhaust the limit at the end of one window, then
 * immediately hit again at the start of the next window.
 * Demonstrates the 2× boundary burst phenomenon.
 */
export const fixedWindowBoundaryBurst: ScenarioConfig = {
  algorithmId: 'fixed-window',
  algorithmConfig: { limit: 5, window: '10s' },
  actions: [
    // Fill up at end of first window
    { delayMs: 9_500, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    { delayMs: 100, key: 'user-1' },
    // Cross window boundary — new window, full quota
    { delayMs: 200, key: 'user-1' },
    { delayMs: 0, key: 'user-1' },
    { delayMs: 0, key: 'user-1' },
    { delayMs: 0, key: 'user-1' },
    { delayMs: 0, key: 'user-1' },
  ],
};

/**
 * Multi-key: two users making requests concurrently.
 * Demonstrates that keys are isolated.
 */
export const fixedWindowMultiKey: ScenarioConfig = {
  algorithmId: 'fixed-window',
  algorithmConfig: { limit: 3, window: '10s' },
  actions: [
    { delayMs: 0, key: 'alice' },
    { delayMs: 0, key: 'bob' },
    { delayMs: 100, key: 'alice' },
    { delayMs: 0, key: 'bob' },
    { delayMs: 100, key: 'alice' },
    { delayMs: 0, key: 'bob' },
    // alice is at limit, bob is at limit
    { delayMs: 100, key: 'alice' }, // denied
    { delayMs: 0, key: 'bob' }, // denied
  ],
};

/**
 * Token bucket burst: 12 rapid requests against capacity of 10.
 * Demonstrates burst absorption and steady refill.
 */
export const tokenBucketBurst: ScenarioConfig = {
  algorithmId: 'token-bucket',
  algorithmConfig: { capacity: 10, refillRate: 2, interval: '1s' },
  actions: [
    { delayMs: 0, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
    // Exhausted capacity: these 2 are denied
    { delayMs: 50, key: 'user-1' },
    { delayMs: 50, key: 'user-1' },
  ],
};

/** All built-in presets, keyed by a human-readable ID. */
export const presets = {
  'fixed-window-burst': fixedWindowBurst,
  'fixed-window-rollover': fixedWindowRollover,
  'fixed-window-boundary-burst': fixedWindowBoundaryBurst,
  'fixed-window-multi-key': fixedWindowMultiKey,
  'token-bucket-burst': tokenBucketBurst,
} as const;

export type PresetId = keyof typeof presets;

/** Preset metadata for the UI. */
export const presetMeta: Record<PresetId, { name: string; description: string }> = {
  'fixed-window-burst': {
    name: 'Basic Burst',
    description: '7 rapid requests against a limit of 5. Last 2 are denied.',
  },
  'fixed-window-rollover': {
    name: 'Window Rollover',
    description: '5 requests, wait for reset, then 3 more. All allowed.',
  },
  'fixed-window-boundary-burst': {
    name: 'Boundary Burst',
    description: 'Demonstrates the 2× burst at window boundaries.',
  },
  'fixed-window-multi-key': {
    name: 'Multi-Key Isolation',
    description: 'Two users with separate limits.',
  },
  'token-bucket-burst': {
    name: 'Token Burst',
    description: '12 rapid requests against capacity 10. Last 2 are denied.',
  },
};
