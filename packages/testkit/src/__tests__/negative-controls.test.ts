import { describe, expect, it } from 'vitest';
import {
  assertAlgorithmClockMonotonicity,
  assertStoreAtomicity,
  assertStoreTtl,
} from '../conformance.js';
import {
  createBackwardsClockGenerousAlgorithm,
  createNonAtomicStore,
  createNoTtlStore,
} from '../broken-doubles.js';
import { FakeClock } from '../fake-clock.js';
import { counterAlgorithm } from '../fixtures.js';

describe('Negative controls for contract suites', () => {
  it('flags non-atomic store under concurrency', async () => {
    const brokenStore = createNonAtomicStore();
    // Non-atomic store yields with await, so concurrent calls race and allow more than limit
    await expect(
      assertStoreAtomicity(brokenStore, counterAlgorithm, { limit: 10, windowMs: 60_000 }, 100),
    ).rejects.toThrow(/Store atomicity violation/);
  });

  it('flags store that ignores TTL', async () => {
    const clock = new FakeClock(1000);
    const brokenStore = createNoTtlStore(clock);
    await expect(
      assertStoreTtl(brokenStore, clock, counterAlgorithm, { limit: 5, windowMs: 1000 }),
    ).rejects.toThrow(/Store failed to expire entry at TTL boundary/);
  });

  it('flags algorithm that is more generous when clock moves backwards', () => {
    const brokenAlgo = createBackwardsClockGenerousAlgorithm();
    expect(() => assertAlgorithmClockMonotonicity(brokenAlgo, { limit: 10 })).toThrow(
      /Algorithm is more generous on backwards clock/,
    );
  });
});
