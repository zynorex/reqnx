import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeFacts } from '../src/facts';

function getRepoRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(curr, 'packages/core/package.json'))) {
      return curr;
    }
    curr = resolve(curr, '..');
  }
  return process.cwd();
}

describe('Computed Build-time Facts', () => {
  const root = getRepoRoot();
  const facts = computeFacts();

  it('computes at least 5 repository facts', () => {
    expect(facts.length).toBeGreaterThanOrEqual(5);
  });

  it('asserts core runtime dependencies are strictly zero', () => {
    const depsFact = facts.find((f) => f.id === 'runtime-deps');
    expect(depsFact).toBeDefined();
    expect(depsFact?.value).toBe('0');
  });

  it('asserts every fact references a real source file on disk', () => {
    for (const fact of facts) {
      const fullPath = resolve(root, fact.sourceFile);
      expect(existsSync(fullPath)).toBe(true);
    }
  });

  it('reports dual ESM + CJS module formats', () => {
    const formatFact = facts.find((f) => f.id === 'module-formats');
    expect(formatFact).toBeDefined();
    expect(formatFact?.value).toContain('Dual ESM + CJS');
  });

  it('reports at least 13 accepted ADRs', () => {
    const adrFact = facts.find((f) => f.id === 'adr-count');
    expect(adrFact).toBeDefined();
    expect(Number(adrFact?.value)).toBeGreaterThanOrEqual(13);
  });
});
