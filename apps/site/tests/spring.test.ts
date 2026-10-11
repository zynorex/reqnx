import { describe, expect, it } from 'vitest';
import { computeSpringPoints, generateLinearSpringCss } from '../scripts/gen-spring.js';

describe('Spring Easing Generator (CSS linear())', () => {
  it('starts at exact 0 and settles at exact 1', () => {
    const points = computeSpringPoints();
    expect(points[0]).toBe(0);
    expect(points[points.length - 1]).toBe(1);
  });

  it('bounds maximum overshoot strictly within 4% (max <= 1.04)', () => {
    const points = computeSpringPoints();
    const maxVal = Math.max(...points);
    expect(maxVal).toBeGreaterThan(1.0); // Has some springiness
    expect(maxVal).toBeLessThanOrEqual(1.04); // Strictly <= 4%
  });

  it('bounds minimum undershoot (>= 0)', () => {
    const points = computeSpringPoints();
    const minVal = Math.min(...points);
    expect(minVal).toBeGreaterThanOrEqual(0);
  });

  it('generates a valid CSS linear() function string', () => {
    const css = generateLinearSpringCss();
    expect(css.startsWith('linear(')).toBe(true);
    expect(css.endsWith(')')).toBe(true);
    const inner = css.slice(7, -1).split(', ');
    expect(inner.length).toBeGreaterThan(20);
    expect(Number(inner[0])).toBe(0);
    expect(Number(inner[inner.length - 1])).toBe(1);
  });
});
