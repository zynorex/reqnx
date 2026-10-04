// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Algorithm ID registry
//
// Each algorithm registers here. Algorithms added Day 3-6.
// ──────────────────────────────────────────────────────────────────────────────

export type { AlgorithmId } from '../types.js';

// Day 3: Fixed Window Counter
export type { FixedWindowInput, FixedWindowConfig, FixedWindowState } from './fixed-window.js';
export { fixedWindow } from './fixed-window.js';

// Day 4: export { tokenBucket } from './token-bucket.js';
// Day 5: export { slidingWindowLog } from './sliding-window-log.js';
// Day 5: export { slidingWindowCounter } from './sliding-window-counter.js';
// Day 6: export { leakyBucket } from './leaky-bucket.js';
