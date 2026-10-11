import { describe, it, expect } from 'vitest';
import type { SegmentedOption } from '../src/components/common/SegmentedControl';

function computeNextIndex(
  currentIndex: number,
  length: number,
  key: string,
): number {
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % length;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + length) % length;
  }
  return currentIndex;
}

describe('SegmentedControl Navigation & Contracts', () => {
  const options: SegmentedOption[] = [
    { value: 'system', label: 'System' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ];

  it('cycles forward on ArrowRight and ArrowDown with wrap-around', () => {
    expect(computeNextIndex(0, options.length, 'ArrowRight')).toBe(1);
    expect(computeNextIndex(1, options.length, 'ArrowRight')).toBe(2);
    // Wrap around to 0
    expect(computeNextIndex(2, options.length, 'ArrowRight')).toBe(0);

    expect(computeNextIndex(0, options.length, 'ArrowDown')).toBe(1);
    expect(computeNextIndex(2, options.length, 'ArrowDown')).toBe(0);
  });

  it('cycles backward on ArrowLeft and ArrowUp with wrap-around', () => {
    // Wrap around backward from 0 to last
    expect(computeNextIndex(0, options.length, 'ArrowLeft')).toBe(2);
    expect(computeNextIndex(2, options.length, 'ArrowLeft')).toBe(1);
    expect(computeNextIndex(1, options.length, 'ArrowLeft')).toBe(0);

    expect(computeNextIndex(0, options.length, 'ArrowUp')).toBe(2);
  });

  it('ignores other keys', () => {
    expect(computeNextIndex(1, options.length, 'Enter')).toBe(1);
    expect(computeNextIndex(1, options.length, 'Tab')).toBe(1);
    expect(computeNextIndex(1, options.length, 'Space')).toBe(1);
  });

  it('generates consistent radio IDs and values', () => {
    const name = 'theme-select';
    const ids = options.map((opt) => `${name}-${opt.value}`);
    expect(ids).toEqual([
      'theme-select-system',
      'theme-select-dark',
      'theme-select-light',
    ]);
  });
});
