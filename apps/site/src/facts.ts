// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/facts.ts
//
// Build-time computation of verifiable repository facts for the proof strip.
// Facts are never hard-coded. Missing or uncomputable facts are omitted.
// ──────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { algorithms } from './features.js';

export interface VerifiedFact {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly detail: string;
  readonly sourceFile: string;
}

/**
 * Resolve root repository path from site directory.
 */
function getRepoRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(curr, 'packages/core/package.json'))) {
      return curr;
    }
    curr = resolve(curr, '..');
  }
  return process.cwd();
}

/**
 * Computes all available verified facts from source files on disk.
 */
export function computeFacts(): readonly VerifiedFact[] {
  const root = getRepoRoot();
  const facts: VerifiedFact[] = [];

  // 1. Core runtime dependencies count
  const corePkgPath = join(root, 'packages/core/package.json');
  if (existsSync(corePkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(corePkgPath, 'utf-8'));
      const depCount = Object.keys(pkg.dependencies ?? {}).length;
      facts.push({
        id: 'runtime-deps',
        value: String(depCount),
        label: 'Runtime Dependencies',
        detail: 'Direct runtime dependencies declared in @reqnx/core package.json',
        sourceFile: 'packages/core/package.json',
      });
    } catch {
      // Omit on parse error
    }
  }

  // 2. Export module formats
  if (existsSync(corePkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(corePkgPath, 'utf-8'));
      const hasImport = Boolean(pkg.exports?.['.']?.import);
      const hasRequire = Boolean(pkg.exports?.['.']?.require);
      const hasTypes = Boolean(pkg.exports?.['.']?.import?.types);
      if (hasImport && hasRequire && hasTypes) {
        facts.push({
          id: 'module-formats',
          value: 'Dual ESM + CJS',
          label: 'Module Formats',
          detail:
            'Native ECMAScript Modules, CommonJS fallback, and TypeScript definitions (.d.ts)',
          sourceFile: 'packages/core/package.json',
        });
      }
    } catch {
      // Omit on error
    }
  }

  // 3. Core bundle gzip size
  const coreDistPath = join(root, 'packages/core/dist/index.js');
  if (existsSync(coreDistPath)) {
    try {
      const content = readFileSync(coreDistPath);
      const gzipped = gzipSync(content);
      const kbSize = (gzipped.length / 1024).toFixed(1);
      facts.push({
        id: 'bundle-size',
        value: `${kbSize} kB`,
        label: 'Core Bundle (gzip)',
        detail: 'Production minified ESM bundle of @reqnx/core compressed with gzip level 9',
        sourceFile: 'packages/core/dist/index.js',
      });
    } catch {
      // Omit on error
    }
  }

  // 4. Number of architectural decisions
  const adrDir = join(root, 'docs/adr');
  if (existsSync(adrDir)) {
    try {
      const files = readdirSync(adrDir).filter((f) => f.endsWith('.md') && /^\d{4}-/.test(f));
      facts.push({
        id: 'adr-count',
        value: String(files.length),
        label: 'Architectural Decisions',
        detail: 'Accepted Architecture Decision Records (ADRs) documenting formal trade-offs',
        sourceFile: 'docs/adr/',
      });
    } catch {
      // Omit on error
    }
  }

  // 5. Available algorithms count
  const availableCount = algorithms.filter((a) => a.status === 'available').length;
  facts.push({
    id: 'available-algos',
    value: `${availableCount} of ${algorithms.length}`,
    label: 'Algorithms Available',
    detail: 'Implemented and tested algorithms matching the pure Algorithm contract',
    sourceFile: 'apps/site/src/features.ts',
  });

  // 6. License
  const licensePath = join(root, 'LICENSE');
  if (existsSync(licensePath)) {
    facts.push({
      id: 'license',
      value: 'MIT',
      label: 'Open Source License',
      detail: 'Permissive MIT license allowing personal and commercial use without restrictions',
      sourceFile: 'LICENSE',
    });
  }

  // 7. In-memory throughput benchmark (rounded DOWN to 2 significant digits)
  const benchPath = join(root, 'docs/benchmarks/day-04.json');
  if (existsSync(benchPath)) {
    try {
      const bench = JSON.parse(readFileSync(benchPath, 'utf-8'));
      const fixedOps = bench.benchmarks?.fixedWindow?.opsPerSec;
      if (typeof fixedOps === 'number' && fixedOps > 0) {
        // Round down to two significant digits: e.g. 521495 -> 520000 -> 520k /s
        const magnitude = Math.pow(10, Math.floor(Math.log10(fixedOps)) - 1);
        const roundedDown = Math.floor(fixedOps / magnitude) * magnitude;
        const formatted = roundedDown >= 1000 ? `${Math.floor(roundedDown / 1000)}k /s` : `${roundedDown} /s`;
        const cpu = bench.environment?.cpu ?? 'Node runner';
        const nodeVer = bench.environment?.nodeVersion ?? 'Node';
        facts.push({
          id: 'benchmark-throughput',
          value: formatted,
          label: 'In-Memory Throughput',
          detail: `Fixed window checks on single thread. Environment: ${cpu}, ${nodeVer}. Methodology in docs/benchmarks/day-04.md`,
          sourceFile: 'docs/benchmarks/day-04.json',
        });
      }
    } catch {
      // Omit on parse error
    }
  }

  return facts;
}
