// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Verifiable Claims Ledger
//
// Every factual statement on the landing page MUST reference an entry in this
// ledger. A test asserts that every referenced claim exists, its evidence path
// exists on disk, and its gating feature is currently available.
// ──────────────────────────────────────────────────────────────────────────────

export interface Claim {
  readonly id: string;
  readonly claim: string;
  readonly evidencePaths: readonly string[];
  readonly gatingFeature: string;
}

export const claims: readonly Claim[] = [
  {
    id: 'claim-zero-deps',
    claim: '@reqnx/core has zero runtime dependencies.',
    evidencePaths: ['packages/core/package.json'],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-module-formats',
    claim: 'Dual ESM and CommonJS builds with bundled TypeScript declarations.',
    evidencePaths: ['packages/core/package.json'],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-pure-step',
    claim:
      'Algorithms are pure step() state machines with no I/O, no system clock calls, and no floating-point arithmetic.',
    evidencePaths: [
      'packages/core/src/algorithms/fixed-window.ts',
      'packages/core/src/algorithms/token-bucket.ts',
      'docs/adr/0002-algorithm-contract-and-atomicity.md',
    ],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-injected-clock',
    claim:
      'Time is injected via a Clock interface, enabling deterministic tests without real-time delays.',
    evidencePaths: ['packages/core/src/clock.ts', 'packages/testkit/src/fake-clock.ts'],
    gatingFeature: 'primitive-clock',
  },
  {
    id: 'claim-atomic-store',
    claim:
      'Store operations are atomic: check, step, and state mutation happen in one step.',
    evidencePaths: [
      'packages/core/src/memory-store.ts',
      'packages/core/src/limiter.ts',
      'docs/adr/0002-algorithm-contract-and-atomicity.md',
    ],
    gatingFeature: 'store-memory',
  },
  {
    id: 'claim-memory-bounds',
    claim:
      'MemoryStore bounds memory with LRU eviction and maximum key capacity.',
    evidencePaths: [
      'packages/core/src/memory-store.ts',
      'docs/adr/0009-memory-store.md',
    ],
    gatingFeature: 'store-memory',
  },
  {
    id: 'claim-failure-policies',
    claim:
      'Configurable failure policies (fail-open, fail-closed, or custom handler) protect traffic if a store fails.',
    evidencePaths: [
      'packages/core/src/limiter.ts',
      'docs/adr/0004-failure-semantics.md',
    ],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-fixed-window-avail',
    claim:
      'Fixed Window Counter partitions time into aligned epoch windows with O(1) time and memory.',
    evidencePaths: [
      'packages/core/src/algorithms/fixed-window.ts',
      'docs/algorithms/fixed-window.md',
    ],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-token-bucket-avail',
    claim:
      'Token Bucket supports smooth continuous refill with burst capacity and variable request costs.',
    evidencePaths: [
      'packages/core/src/algorithms/token-bucket.ts',
      'docs/algorithms/token-bucket.md',
      'docs/adr/0014-token-bucket-algorithm.md',
    ],
    gatingFeature: 'algo-token-bucket',
  },
  {
    id: 'claim-browser-execution',
    claim:
      'The live console runs the real @reqnx/core library inside your browser using a virtual clock.',
    evidencePaths: [
      'apps/site/src/engine/scenario.ts',
      'docs/adr/0012-browser-demo-architecture.md',
    ],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-contract-tests',
    claim:
      'Reusable contract suites test any store or algorithm implementation against the specification.',
    evidencePaths: [
      'packages/testkit/src/conformance.ts',
      'packages/testkit/src/__tests__/algorithm-contract.test.ts',
    ],
    gatingFeature: 'primitive-testkit',
  },
  {
    id: 'claim-model-tested',
    claim:
      'Token Bucket is verified against an independent discrete oracle over thousands of fast-check sequences.',
    evidencePaths: [
      'packages/core/src/__tests__/token-bucket.model.test.ts',
      'packages/core/src/__tests__/token-bucket.properties.test.ts',
    ],
    gatingFeature: 'algo-token-bucket',
  },
  {
    id: 'claim-adr-count',
    claim:
      '14 architectural decisions recorded in docs/adr/ documenting every technical trade-off.',
    evidencePaths: ['docs/adr/0001-package-boundaries.md'],
    gatingFeature: 'algo-fixed-window',
  },
  {
    id: 'claim-benchmark-throughput',
    claim:
      'In-memory throughput: 520,000 checks per second on a single thread (12th Gen Intel i5-12500H, Node v24.12.0, Oct 2026).',
    evidencePaths: [
      'docs/benchmarks/day-03.json',
      'docs/benchmarks/day-04.json',
    ],
    gatingFeature: 'algo-fixed-window',
  },
] as const;

export function getClaim(id: string): Claim | undefined {
  return claims.find((c) => c.id === id);
}
