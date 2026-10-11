import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { claims } from '../src/data/claims';
import { allFeatures } from '../src/features';

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

describe('Claims Ledger Conformance', () => {
  const root = getRepoRoot();

  it('ensures every claim has a unique ID and non-empty claim statement', () => {
    const ids = new Set<string>();
    for (const c of claims) {
      expect(c.id).toBeTruthy();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.claim.trim().length).toBeGreaterThan(10);
      expect(c.evidencePaths.length).toBeGreaterThan(0);
    }
  });

  it('ensures every evidence path recorded in claims exists on disk', () => {
    for (const c of claims) {
      for (const p of c.evidencePaths) {
        const fullPath = join(root, p);
        expect(existsSync(fullPath)).toBe(true);
      }
    }
  });

  it('ensures gating features for verified claims are currently available', () => {
    const availableFeatureIds = new Set(
      allFeatures.filter((f) => f.status === 'available').map((f) => f.id),
    );

    for (const c of claims) {
      if (
        c.gatingFeature.startsWith('algo-') ||
        c.gatingFeature.startsWith('primitive-') ||
        c.gatingFeature.startsWith('store-')
      ) {
        expect(availableFeatureIds.has(c.gatingFeature)).toBe(true);
      }
    }
  });
});
