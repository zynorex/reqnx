// ──────────────────────────────────────────────────────────────────────────────
// REQNX — Comparison & Equivalence Tests
//
// Asserts that leakyBucket and tokenBucket make 100% identical decisions
// across all traffic scenarios, and verifies docs/algorithms/comparison.md freshness.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runAllScenarios, generateMarkdown } from './comparison-harness.js';

describe('Algorithm Comparison Suite & Equivalence Proof', () => {
  it('proves by run that leakyBucket and tokenBucket make identical Decisions on every scenario', () => {
    const results = runAllScenarios();
    expect(results.length).toBeGreaterThan(0);

    for (const r of results) {
      expect(r.lb.allowed).toBe(r.tb.allowed);
      expect(r.lb.limit).toBe(r.tb.limit);
      expect(r.lb.remaining).toBe(r.tb.remaining);
      expect(r.lb.resetAtMs).toBe(r.tb.resetAtMs);
      expect(r.lb.retryAfterMs).toBe(r.tb.retryAfterMs);
      expect(r.lb.degraded).toBe(r.tb.degraded);
    }
  });

  it('matches checked-in docs/algorithms/comparison.md', () => {
    const results = runAllScenarios();
    const generated = generateMarkdown(results);
    const repoRoot = path.resolve(__dirname, '../../../../');
    const docPath = path.resolve(repoRoot, 'docs/algorithms/comparison.md');

    expect(fs.existsSync(docPath)).toBe(true);
    const currentDoc = fs.readFileSync(docPath, 'utf8');
    expect(currentDoc).toBe(generated);
  });
});
