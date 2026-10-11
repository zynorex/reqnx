import { describe, it, expect } from 'vitest';
import { algorithms, getAlgorithm, getAvailableAlgorithms } from '../src/features';

describe('Algorithm Registry', () => {
  it('contains exactly five algorithms', () => {
    expect(algorithms).toHaveLength(5);
  });

  it('marks fixed-window and token-bucket as available and others as coming-soon', () => {
    const fixedWindowEntry = algorithms.find((a) => a.id === 'fixed-window');
    expect(fixedWindowEntry).toBeDefined();
    expect(fixedWindowEntry?.status).toBe('available');

    const tokenBucketEntry = algorithms.find((a) => a.id === 'token-bucket');
    expect(tokenBucketEntry).toBeDefined();
    expect(tokenBucketEntry?.status).toBe('available');

    const others = algorithms.filter((a) => a.id !== 'fixed-window' && a.id !== 'token-bucket');
    for (const algo of others) {
      expect(algo.status).toBe('coming-soon');
    }
  });

  it('provides getAlgorithm lookup by ID', () => {
    const found = getAlgorithm('fixed-window');
    expect(found?.name).toBe('Fixed Window Counter');
    expect(
      getAlgorithm('non-existent' as unknown as Parameters<typeof getAlgorithm>[0]),
    ).toBeUndefined();
  });

  it('returns only available algorithms in getAvailableAlgorithms', () => {
    const available = getAvailableAlgorithms();
    expect(available).toHaveLength(2);
    expect(available.map((a) => a.id)).toContain('fixed-window');
    expect(available.map((a) => a.id)).toContain('token-bucket');
  });

  it('ensures each algorithm has complexity metadata and slug', () => {
    for (const algo of algorithms) {
      expect(algo.slug).toBeTruthy();
      expect(algo.timeComplexity).toMatch(/^O\(/);
      expect(algo.spaceComplexity).toMatch(/^O\(/);
      expect(algo.defaultConfig).toBeDefined();
    }
  });
});
