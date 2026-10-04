import { describe, expect, it } from 'vitest';
import { ConfigError, InputError, RateLimitError, StoreError } from '../errors.js';

describe('Error hierarchy', () => {
  it('ConfigError inherits from RateLimitError and Error', () => {
    const err = new ConfigError('Invalid max');
    expect(err).toBeInstanceOf(ConfigError);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConfigError');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.message).toBe('Invalid max');
  });

  it('StoreError inherits from RateLimitError and Error', () => {
    const cause = new Error('Connection timeout');
    const err = new StoreError('Redis down', { cause });
    expect(err).toBeInstanceOf(StoreError);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('StoreError');
    expect(err.code).toBe('STORE_ERROR');
    expect(err.message).toBe('Redis down');
    expect(err.cause).toBe(cause);
  });

  it('InputError inherits from RateLimitError and Error', () => {
    const err = new InputError('Key too long');
    expect(err).toBeInstanceOf(InputError);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InputError');
    expect(err.code).toBe('INPUT_ERROR');
    expect(err.message).toBe('Key too long');
  });

  it('Subclasses do not falsely match sibling instanceof checks', () => {
    const configErr = new ConfigError('cfg');
    const storeErr = new StoreError('store');
    const inputErr = new InputError('input');

    expect(configErr instanceof StoreError).toBe(false);
    expect(configErr instanceof InputError).toBe(false);

    expect(storeErr instanceof ConfigError).toBe(false);
    expect(storeErr instanceof InputError).toBe(false);

    expect(inputErr instanceof ConfigError).toBe(false);
    expect(inputErr instanceof StoreError).toBe(false);
  });

  it('Supports cross-ESM/CJS boundary instanceof via Symbol.for("reqnx.error")', () => {
    const BRAND = Symbol.for('reqnx.error');

    // Simulate an object constructed from a different copy of the library
    const foreignConfig = {
      [BRAND]: 'ConfigError',
    };
    const foreignStore = {
      [BRAND]: 'StoreError',
    };
    const foreignInput = {
      [BRAND]: 'InputError',
    };
    const foreignUnknown = {
      [BRAND]: 'SomeOtherRateLimitError',
    };
    const nonBranded = {
      name: 'ConfigError',
    };

    expect(foreignConfig instanceof RateLimitError).toBe(true);
    expect(foreignConfig instanceof ConfigError).toBe(true);
    expect(foreignConfig instanceof StoreError).toBe(false);

    expect(foreignStore instanceof RateLimitError).toBe(true);
    expect(foreignStore instanceof StoreError).toBe(true);
    expect(foreignStore instanceof InputError).toBe(false);

    expect(foreignInput instanceof RateLimitError).toBe(true);
    expect(foreignInput instanceof InputError).toBe(true);
    expect(foreignInput instanceof ConfigError).toBe(false);

    expect(foreignUnknown instanceof RateLimitError).toBe(true);
    expect(foreignUnknown instanceof ConfigError).toBe(false);

    expect(nonBranded instanceof RateLimitError).toBe(false);
    expect(nonBranded instanceof ConfigError).toBe(false);
    expect(RateLimitError[Symbol.hasInstance](null)).toBe(false);
    expect(RateLimitError[Symbol.hasInstance](undefined)).toBe(false);
  });
});
