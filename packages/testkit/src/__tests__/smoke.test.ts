import { describe, it, expect } from 'vitest';
import { FakeClock } from '../index.js';

describe('@reqnx/testkit smoke tests', () => {
  it('FakeClock starts at the given time', () => {
    const clock = new FakeClock(1000);
    expect(clock.nowMs()).toBe(1000);
  });

  it('FakeClock.advance() moves time forward', () => {
    const clock = new FakeClock(0);
    clock.advance(5000);
    expect(clock.nowMs()).toBe(5000);
  });

  it('FakeClock.set() sets exact time', () => {
    const clock = new FakeClock(0);
    clock.set(99999);
    expect(clock.nowMs()).toBe(99999);
  });

  it('FakeClock.advance() rejects negative values', () => {
    const clock = new FakeClock(1000);
    expect(() => clock.advance(-1)).toThrow('Cannot advance clock by a negative amount');
  });
});
