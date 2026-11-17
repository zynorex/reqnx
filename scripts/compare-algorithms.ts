/* eslint-disable no-console */
// ──────────────────────────────────────────────────────────────────────────────
// REQNX — Algorithm Comparison CLI Generator
// ──────────────────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  runAllScenarios,
  generateMarkdown,
} from '../packages/core/src/__tests__/comparison-harness.js';

export function writeComparisonDoc(): void {
  const results = runAllScenarios();
  const md = generateMarkdown(results);
  const repoRoot = path.resolve(__dirname, '..');
  const outPath = path.resolve(repoRoot, 'docs/algorithms/comparison.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`Generated ${outPath} (${results.length} steps evaluated)`);
}

writeComparisonDoc();
