import { describe, it, expect } from 'vitest';
import { ConfigError, StoreError, SystemClock, MAX_KEY_BYTES } from '../index.js';

describe('@reqnx/core smoke tests', () => {
  it('exports ConfigError with correct code', () => {
    const err = new ConfigError('test');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.name).toBe('ConfigError');
    expect(err).toBeInstanceOf(Error);
  });

  it('exports StoreError with correct code', () => {
    const err = new StoreError('test');
    expect(err.code).toBe('STORE_ERROR');
    expect(err.name).toBe('StoreError');
    expect(err).toBeInstanceOf(Error);
  });

  it('SystemClock.nowMs() returns a number close to Date.now()', () => {
    const before = Date.now();
    const now = SystemClock.nowMs();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('MAX_KEY_BYTES is 512', () => {
    expect(MAX_KEY_BYTES).toBe(512);
  });
});
