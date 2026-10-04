// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Algorithm registry and availability flags
//
// Central registry of all algorithms. Used by the playground, algorithm pages,
// and the comparison table to know which algorithms are available for demos.
// ──────────────────────────────────────────────────────────────────────────────

import type { AlgorithmId } from '@reqnx/core';

/** Status of an algorithm's implementation. */
export type AlgorithmStatus = 'available' | 'coming-soon';

/** Registry entry for one algorithm. */
export interface AlgorithmEntry {
  /** Algorithm ID matching @reqnx/core. */
  id: AlgorithmId;
  /** Human-readable display name. */
  name: string;
  /** One-line description (plain, factual). */
  description: string;
  /** Implementation status. Only 'available' algorithms can run demos. */
  status: AlgorithmStatus;
  /** URL slug for the algorithm page. */
  slug: string;
  /** Time complexity of step(). */
  timeComplexity: string;
  /** Space complexity per key. */
  spaceComplexity: string;
  /** Default demo config for the playground. */
  defaultConfig: Record<string, unknown>;
}

/**
 * All algorithms in the REQNX library, in display order.
 *
 * Update `status` as algorithms are implemented on subsequent days.
 */
export const algorithms: readonly AlgorithmEntry[] = [
  {
    id: 'fixed-window',
    name: 'Fixed Window Counter',
    description:
      'Divides time into non-overlapping windows. Simplest and highest throughput. Allows 2× burst at window boundaries.',
    status: 'available',
    slug: 'fixed-window',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { limit: 5, window: '10s' },
  },
  {
    id: 'token-bucket',
    name: 'Token Bucket',
    description:
      'Tokens refill at a steady rate. Allows controlled bursts up to bucket capacity. Smooth rate enforcement.',
    status: 'coming-soon',
    slug: 'token-bucket',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { capacity: 10, refillRate: 1, interval: '1s' },
  },
  {
    id: 'sliding-window-log',
    name: 'Sliding Window Log',
    description:
      'Tracks every request timestamp. Exact counts over any sliding interval. Higher memory per key.',
    status: 'coming-soon',
    slug: 'sliding-window-log',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    defaultConfig: { limit: 5, window: '10s' },
  },
  {
    id: 'sliding-window-counter',
    name: 'Sliding Window Counter',
    description: 'Weighted estimate from two fixed windows. Near-exact accuracy with O(1) space.',
    status: 'coming-soon',
    slug: 'sliding-window-counter',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { limit: 5, window: '10s' },
  },
  {
    id: 'leaky-bucket',
    name: 'Leaky Bucket',
    description:
      'Requests queue and drain at a fixed rate. Strict output smoothing. No bursts allowed.',
    status: 'coming-soon',
    slug: 'leaky-bucket',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { capacity: 5, drainRate: 1, interval: '1s' },
  },
] as const;

/** Get an algorithm entry by ID. */
export function getAlgorithm(id: AlgorithmId): AlgorithmEntry | undefined {
  return algorithms.find((a) => a.id === id);
}

/** Get only algorithms that are available for demos. */
export function getAvailableAlgorithms(): readonly AlgorithmEntry[] {
  return algorithms.filter((a) => a.status === 'available');
}
