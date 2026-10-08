// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Algorithm registry and feature availability
//
// Central registry of all algorithms, stores, and features.
// Every 'available' feature MUST have an evidencePath pointing to a real file.
// ──────────────────────────────────────────────────────────────────────────────

import type { AlgorithmId } from '@reqnx/core';

/** Status of a feature or algorithm implementation. */
export type FeatureStatus = 'available' | 'in-progress' | 'planned';
export type AlgorithmStatus = 'available' | 'coming-soon';

/** Conceptual algorithmic trade-offs. */
export interface AlgorithmTraits {
  readonly memoryPerKey: string;
  readonly burstBehavior: string;
  readonly boundaryBehavior: string;
  readonly accuracy: string;
}

/** Registry entry for one algorithm. */
export interface AlgorithmEntry {
  /** Algorithm ID matching @reqnx/core. */
  readonly id: AlgorithmId;
  /** Human-readable display name. */
  readonly name: string;
  /** One-line description (plain, factual). */
  readonly description: string;
  /** Implementation status. Only 'available' algorithms can run demos. */
  readonly status: AlgorithmStatus;
  /** URL slug for the algorithm page. */
  readonly slug: string;
  /** Time complexity of step(). */
  readonly timeComplexity: string;
  /** Space complexity per key. */
  readonly spaceComplexity: string;
  /** Default demo config for the playground. */
  readonly defaultConfig: Record<string, unknown>;
  /** Key algorithmic traits for comparison. */
  readonly traits: AlgorithmTraits;
  /** Default preset ID for thumbnail / hero. */
  readonly signaturePreset?: string;
  /** Path to source code or tests proving implementation. */
  readonly evidencePath?: string;
}

/** All algorithms in the REQNX library, in display order. */
export const algorithms: readonly AlgorithmEntry[] = [
  {
    id: 'fixed-window',
    name: 'Fixed Window Counter',
    description:
      'Divides time into non-overlapping windows. Simplest and highest throughput. Allows 2x burst at window boundaries.',
    status: 'available',
    slug: 'fixed-window',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { limit: 5, window: '10s' },
    traits: {
      memoryPerKey: '~270 bytes (single counter)',
      burstBehavior: 'Full window quota admitted instantly',
      boundaryBehavior: 'Up to 2x limit across window boundaries',
      accuracy: 'Exact count per aligned epoch window',
    },
    signaturePreset: 'fixed-window-burst',
    evidencePath: 'packages/core/src/algorithms/fixed-window.ts',
  },
  {
    id: 'token-bucket',
    name: 'Token Bucket',
    description:
      'Tokens refill at a steady rate. Allows controlled bursts up to bucket capacity. Smooth rate enforcement.',
    status: 'available',
    slug: 'token-bucket',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { capacity: 10, refillRate: 2, interval: '1s' },
    traits: {
      memoryPerKey: '~320 bytes (tokens + last refill)',
      burstBehavior: 'Limited to maximum bucket capacity',
      boundaryBehavior: 'Smooth, continuous refill',
      accuracy: 'Exact continuous token balance',
    },
    signaturePreset: 'token-bucket-burst',
    evidencePath: 'packages/core/src/algorithms/token-bucket.ts',
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
    traits: {
      memoryPerKey: 'O(n) per admitted timestamp',
      burstBehavior: 'Strict rolling limit; zero boundary burst',
      boundaryBehavior: 'Completely smooth rolling boundary',
      accuracy: '100% exact rolling window count',
    },
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
    traits: {
      memoryPerKey: '~350 bytes (current + previous count)',
      burstBehavior: 'Weighted smoothing across boundary',
      boundaryBehavior: 'Interpolated boundary transition',
      accuracy: 'Near-exact heuristic approximation',
    },
  },
  {
    id: 'leaky-bucket',
    name: 'Leaky Bucket',
    description:
      'Requests queue and drain at a fixed rate. Strict output smoothing. Zero burst allowed.',
    status: 'coming-soon',
    slug: 'leaky-bucket',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    defaultConfig: { capacity: 5, drainRate: 1, interval: '1s' },
    traits: {
      memoryPerKey: '~320 bytes (water level + last leak)',
      burstBehavior: 'Zero burst permitted (constant drain)',
      boundaryBehavior: 'Completely continuous drain queue',
      accuracy: 'Exact output rate smoothing',
    },
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

/** Generic feature entry for library components (stores, adapters, etc.). */
export interface FeatureItem {
  readonly id: string;
  readonly kind: 'algorithm' | 'store' | 'adapter' | 'primitive';
  readonly name: string;
  readonly status: FeatureStatus;
  readonly blurb: string;
  readonly evidencePath?: string;
  readonly docsUrl?: string;
}

/** Full registry of all REQNX library features for status tracking. */
export const allFeatures: readonly FeatureItem[] = [
  {
    id: 'algo-fixed-window',
    kind: 'algorithm',
    name: 'Fixed Window Counter',
    status: 'available',
    blurb: 'Pure step() state machine with epoch alignment and NTP monotonicity.',
    evidencePath: 'packages/core/src/algorithms/fixed-window.ts',
    docsUrl: '/algorithms/fixed-window/',
  },
  {
    id: 'algo-token-bucket',
    kind: 'algorithm',
    name: 'Token Bucket',
    status: 'available',
    blurb: 'Continuous token refill with burst capacity control.',
    evidencePath: 'packages/core/src/algorithms/token-bucket.ts',
    docsUrl: '/algorithms/token-bucket/',
  },
  {
    id: 'algo-sliding-log',
    kind: 'algorithm',
    name: 'Sliding Window Log',
    status: 'planned',
    blurb: 'Exact rolling window history using timestamp sets.',
  },
  {
    id: 'algo-sliding-counter',
    kind: 'algorithm',
    name: 'Sliding Window Counter',
    status: 'planned',
    blurb: 'Dual-window weighted estimation with constant memory.',
  },
  {
    id: 'algo-leaky-bucket',
    kind: 'algorithm',
    name: 'Leaky Bucket',
    status: 'planned',
    blurb: 'Strict constant-rate output queue smoothing.',
  },
  {
    id: 'store-memory',
    kind: 'store',
    name: 'MemoryStore',
    status: 'available',
    blurb: 'Synchronous atomic in-memory store with LRU eviction and memory bounds.',
    evidencePath: 'packages/core/src/memory-store.ts',
  },
  {
    id: 'store-redis',
    kind: 'store',
    name: 'RedisStore + Lua',
    status: 'planned',
    blurb: 'Distributed atomic Lua scripts running on Redis via EVALSHA.',
  },
  {
    id: 'adapter-express',
    kind: 'adapter',
    name: 'Express Middleware',
    status: 'planned',
    blurb: 'Standard Express middleware setting IETF RateLimit headers.',
  },
  {
    id: 'adapter-fastify',
    kind: 'adapter',
    name: 'Fastify Plugin',
    status: 'planned',
    blurb: 'Fastify plugin with onRequest hook and custom key resolvers.',
  },
  {
    id: 'primitive-clock',
    kind: 'primitive',
    name: 'Injected Clock Interface',
    status: 'available',
    blurb: 'Decoupled time abstraction for deterministic testing.',
    evidencePath: 'packages/core/src/clock.ts',
  },
  {
    id: 'primitive-keys',
    kind: 'primitive',
    name: 'Strict Key Builder',
    status: 'available',
    blurb: 'Deterministic key formatting rejecting oversized keys with InputError.',
    evidencePath: 'packages/core/src/keys.ts',
  },
  {
    id: 'primitive-testkit',
    kind: 'primitive',
    name: 'Contract Testkit',
    status: 'available',
    blurb: 'Reusable contract suites validating any store or algorithm implementation.',
    evidencePath: 'packages/testkit/src/conformance.ts',
  },
] as const;
