import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { runAlgorithmContractSuite } from '../conformance.js';
import { allowAllAlgorithm, counterAlgorithm } from '../fixtures.js';
import { fixedWindow } from '@reqnx/core';

runAlgorithmContractSuite(counterAlgorithm, { limit: 10, windowMs: 1000 });
runAlgorithmContractSuite(allowAllAlgorithm, {});
runAlgorithmContractSuite(fixedWindow, { limit: 10, windowMs: 1000 });

describe('Algorithm Contract Properties (fast-check)', () => {
  it('counterAlgorithm preserves 0 <= remaining <= limit for arbitrary positive costs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // limit
        fc.integer({ min: 1, max: 100 }), // cost
        fc.integer({ min: 0, max: 100_000 }), // nowMs
        (limit, cost, nowMs) => {
          const config = { limit, windowMs: 10_000 };
          const res = counterAlgorithm.step(undefined, config, nowMs, cost);
          expect(res.decision.remaining).toBeGreaterThanOrEqual(0);
          expect(res.decision.remaining).toBeLessThanOrEqual(limit);
          if (res.decision.allowed) {
            expect(res.decision.retryAfterMs).toBe(0);
          } else {
            expect(res.decision.retryAfterMs).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});
