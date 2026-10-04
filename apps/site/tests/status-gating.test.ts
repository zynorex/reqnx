import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { allFeatures, algorithms } from '../src/features';

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

describe('Feature Registry & Status Gating Evidence', () => {
  const root = getRepoRoot();

  it('ensures every available feature has evidence that exists on disk', () => {
    const availableFeatures = allFeatures.filter((f) => f.status === 'available');
    expect(availableFeatures.length).toBeGreaterThan(0);

    for (const feature of availableFeatures) {
      expect(feature.evidencePath).toBeDefined();
      const pathOnDisk = resolve(root, feature.evidencePath!);
      expect(existsSync(pathOnDisk)).toBe(true);
    }
  });

  it('ensures every available algorithm has evidence that exists on disk', () => {
    const availableAlgos = algorithms.filter((a) => a.status === 'available');
    expect(availableAlgos.length).toBe(1);

    for (const algo of availableAlgos) {
      expect(algo.evidencePath).toBeDefined();
      const pathOnDisk = resolve(root, algo.evidencePath!);
      expect(existsSync(pathOnDisk)).toBe(true);
    }
  });

  it('ensures planned features do not falsely claim evidence paths', () => {
    const plannedFeatures = allFeatures.filter((f) => f.status === 'planned');
    for (const feature of plannedFeatures) {
      expect(feature.evidencePath).toBeUndefined();
    }
  });
});
