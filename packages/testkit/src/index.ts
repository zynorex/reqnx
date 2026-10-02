// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/testkit — Public API
// ──────────────────────────────────────────────────────────────────────────────

export { FakeClock } from './fake-clock.js';

export {
  runConformanceSuite,
  runStoreContractSuite,
  runAlgorithmContractSuite,
  assertStoreAtomicity,
  assertStoreTtl,
  assertAlgorithmClockMonotonicity,
} from './conformance.js';

export type { ConformanceStep, ConformanceCase, StoreHarness } from './conformance.js';

export { counterAlgorithm, allowAllAlgorithm } from './fixtures.js';

export type { CounterConfig, CounterState, AllowAllConfig } from './fixtures.js';

export {
  createNonAtomicStore,
  createNoTtlStore,
  createBackwardsClockGenerousAlgorithm,
} from './broken-doubles.js';
