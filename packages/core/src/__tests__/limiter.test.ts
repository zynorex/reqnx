import { describe, expect, it, vi } from 'vitest';
import { createLimiter } from '../limiter.js';
import { createMemoryStore } from '../memory-store.js';
import { ConfigError, InputError, StoreError } from '../errors.js';
import { counterAlgorithm, createTestClock } from './test-helpers.js';
import { type Store } from '../types.js';

describe('createLimiter', () => {
  const clock = createTestClock(1000);
  const validConfig = { limit: 10, windowMs: 1000 };

  describe('construction validation', () => {
    it('throws ConfigError if options is missing or not an object', () => {
      expect(() => createLimiter(null as unknown as Parameters<typeof createLimiter>[0])).toThrow(
        ConfigError,
      );
      expect(() =>
        createLimiter(undefined as unknown as Parameters<typeof createLimiter>[0]),
      ).toThrow(ConfigError);
    });

    it('throws ConfigError if algorithm or store is missing', () => {
      const store = createMemoryStore({ clock });
      expect(() =>
        createLimiter({
          algorithm: null as unknown as typeof counterAlgorithm,
          store,
          prefix: 'api',
          config: validConfig,
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store: null as unknown as Store,
          prefix: 'api',
          config: validConfig,
        }),
      ).toThrow(ConfigError);
    });

    it('throws ConfigError if prefix is empty or invalid', () => {
      const store = createMemoryStore({ clock });
      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store,
          prefix: '',
          config: validConfig,
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store,
          prefix: 'api:v1',
          config: validConfig,
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store,
          prefix: 'api v1',
          config: validConfig,
        }),
      ).toThrow(ConfigError);
    });

    it('throws ConfigError if both or neither of config and resolver are provided', () => {
      const store = createMemoryStore({ clock });
      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store,
          prefix: 'api',
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store,
          prefix: 'api',
          config: validConfig,
          resolver: () => validConfig,
        }),
      ).toThrow(ConfigError);
    });

    it('eagerly validates static config via algorithm.parseConfig', () => {
      const store = createMemoryStore({ clock });
      expect(() =>
        createLimiter({
          algorithm: counterAlgorithm,
          store,
          prefix: 'api',
          config: { limit: -1, windowMs: 1000 },
        }),
      ).toThrow(ConfigError);

      const throwingAlgo = {
        ...counterAlgorithm,
        parseConfig() {
          throw new TypeError('Generic parse error');
        },
      };

      expect(() =>
        createLimiter({
          algorithm: throwingAlgo,
          store,
          prefix: 'api',
          config: validConfig,
        }),
      ).toThrow(ConfigError);
    });
  });

  describe('check() input validation', () => {
    it('rejects empty identity with InputError', async () => {
      const store = createMemoryStore({ clock });
      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
      });

      await expect(limiter.check('')).rejects.toThrow(InputError);
    });

    it('rejects identity with control characters with InputError', async () => {
      const store = createMemoryStore({ clock });
      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
      });

      await expect(limiter.check('user\x00')).rejects.toThrow(InputError);
      await expect(limiter.check('user\n')).rejects.toThrow(InputError);
    });

    it('rejects invalid cost with InputError', async () => {
      const store = createMemoryStore({ clock });
      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
      });

      await expect(limiter.check('user', { cost: 0 })).rejects.toThrow(InputError);
      await expect(limiter.check('user', { cost: -1 })).rejects.toThrow(InputError);
      await expect(limiter.check('user', { cost: 1.5 })).rejects.toThrow(InputError);
      await expect(limiter.check('user', { cost: NaN })).rejects.toThrow(InputError);
    });
  });

  describe('key schema and store integration', () => {
    it('passes fully-qualified key reqnx:{prefix}:{algorithmId}:{identity} to store', async () => {
      let passedKey = '';
      const mockStore: Store = {
        id: 'mock',
        consume: async (_algo, key, _cfg, _cost) => {
          passedKey = key;
          return {
            allowed: true,
            limit: 10,
            remaining: 9,
            resetAtMs: 1000,
            retryAfterMs: 0,
            degraded: false,
          };
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: mockStore,
        prefix: 'test-prefix',
        config: validConfig,
      });

      await limiter.check('client-ip-42');
      expect(passedKey).toBe('reqnx:test-prefix:counter:client-ip-42');
    });

    it('defaults cost to 1', async () => {
      let passedCost = -1;
      const mockStore: Store = {
        id: 'mock',
        consume: async (_algo, _key, _cfg, cost) => {
          passedCost = cost;
          return {
            allowed: true,
            limit: 10,
            remaining: 9,
            resetAtMs: 1000,
            retryAfterMs: 0,
            degraded: false,
          };
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: mockStore,
        prefix: 'api',
        config: validConfig,
      });

      await limiter.check('user');
      expect(passedCost).toBe(1);
    });
  });

  describe('failure policies', () => {
    it('default policy is fail-open with degraded: true', async () => {
      const failingStore: Store = {
        id: 'failing',
        consume: async () => {
          throw new StoreError('Redis down');
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: failingStore,
        prefix: 'api',
        config: validConfig,
      });

      const decision = await limiter.check('user');
      expect(decision.allowed).toBe(true);
      expect(decision.degraded).toBe(true);
      expect(decision.limit).toBe(0);
      expect(decision.remaining).toBe(0);
    });

    it('fail-closed policy returns denied decision with degraded: true', async () => {
      const failingStore: Store = {
        id: 'failing',
        consume: async () => {
          throw new StoreError('Redis down');
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: failingStore,
        prefix: 'api',
        config: validConfig,
        onStoreError: 'fail-closed',
      });

      const decision = await limiter.check('user');
      expect(decision.allowed).toBe(false);
      expect(decision.degraded).toBe(true);
    });

    it('custom failure handler returns custom decision with degraded: true', async () => {
      const failingStore: Store = {
        id: 'failing',
        consume: async () => {
          throw new StoreError('Redis down');
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const customHandler = vi.fn().mockReturnValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        resetAtMs: 9999,
        retryAfterMs: 5000,
        degraded: false,
      });

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: failingStore,
        prefix: 'api',
        config: validConfig,
        onStoreError: customHandler,
      });

      const decision = await limiter.check('user', { cost: 2 });
      expect(customHandler).toHaveBeenCalledTimes(1);
      const [err, ctx] = customHandler.mock.calls[0]!;
      expect(err).toBeInstanceOf(StoreError);
      expect(ctx).toEqual({
        key: 'user',
        cost: 2,
        algorithmId: 'counter',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.degraded).toBe(true); // must always be marked degraded
    });

    it('throwing custom handler falls back to fail-open with degraded: true', async () => {
      const failingStore: Store = {
        id: 'failing',
        consume: async () => {
          throw new StoreError('Redis down');
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: failingStore,
        prefix: 'api',
        config: validConfig,
        onStoreError: () => {
          throw new Error('Custom handler crashed!');
        },
      });

      const decision = await limiter.check('user');
      expect(decision.allowed).toBe(true);
      expect(decision.degraded).toBe(true);
    });
  });

  describe('hooks safety and isolation', () => {
    it('fires onDecision hook after successful check', async () => {
      const store = createMemoryStore({ clock });
      const onDecision = vi.fn();

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
        hooks: { onDecision },
      });

      const d = await limiter.check('user', { cost: 2 });
      expect(onDecision).toHaveBeenCalledTimes(1);
      const event = onDecision.mock.calls[0]![0];
      expect(event.key).toBe('user');
      expect(event.algorithmId).toBe('counter');
      expect(event.decision).toEqual(d);
      expect(event.cost).toBe(2);
      expect(typeof event.durationMs).toBe('number');
    });

    it('fires onError and onDecision hooks on store failure', async () => {
      const failingStore: Store = {
        id: 'failing',
        consume: async () => {
          throw new StoreError('Disk failure');
        },
        peek: vi.fn(),
        reset: vi.fn(),
        close: vi.fn(),
      };

      const onError = vi.fn();
      const onDecision = vi.fn();

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: failingStore,
        prefix: 'api',
        config: validConfig,
        hooks: { onError, onDecision },
      });

      const decision = await limiter.check('user', { cost: 1 });
      expect(onError).toHaveBeenCalledTimes(1);
      const errEvent = onError.mock.calls[0]![0];
      expect(errEvent.key).toBe('user');
      expect(errEvent.error.message).toBe('Disk failure');
      expect(errEvent.fallbackDecision).toEqual(decision);

      expect(onDecision).toHaveBeenCalledTimes(1);
      const decEvent = onDecision.mock.calls[0]![0];
      expect(decEvent.decision.degraded).toBe(true);
    });

    it('swallows throwing sync hooks and rejected async hooks without affecting decision', async () => {
      const store = createMemoryStore({ clock });

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
        hooks: {
          onDecision: () => {
            throw new Error('Sync hook exploded');
          },
        },
      });

      const decision = await limiter.check('user');
      expect(decision.allowed).toBe(true);

      const limiterAsync = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
        hooks: {
          onDecision: async () => {
            throw new Error('Async hook rejected');
          },
        },
      });

      const decision2 = await limiterAsync.check('user');
      expect(decision2.allowed).toBe(true);
    });
  });

  describe('dynamic config resolver', () => {
    it('calls resolver per request and validates config', async () => {
      const store = createMemoryStore({ clock });
      const resolver = vi.fn().mockImplementation((key: string) => {
        if (key === 'tier:pro') return { limit: 100, windowMs: 1000 };
        return { limit: 5, windowMs: 1000 };
      });

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        resolver,
      });

      const dPro = await limiter.check('tier:pro');
      expect(dPro.limit).toBe(100);

      const dBasic = await limiter.check('tier:basic');
      expect(dBasic.limit).toBe(5);

      expect(resolver).toHaveBeenCalledTimes(2);
    });

    it('propagates ConfigError from resolver without store fallback', async () => {
      const store = createMemoryStore({ clock });
      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        resolver: () => ({ limit: -99, windowMs: 1000 }), // invalid limit
      });

      await expect(limiter.check('user')).rejects.toThrow(ConfigError);
    });
  });

  describe('peek() and reset()', () => {
    it('peek delegates to store.peek with cost 0 and fires onDecision hook', async () => {
      const store = createMemoryStore({ clock });
      const onDecision = vi.fn();

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
        hooks: { onDecision },
      });

      const peekDec = await limiter.peek('user');
      expect(peekDec.allowed).toBe(true);
      expect(peekDec.remaining).toBe(10);

      expect(onDecision).toHaveBeenCalledTimes(1);
      expect(onDecision.mock.calls[0]![0].cost).toBe(0);
    });

    it('peek handles store error via onStoreError policy', async () => {
      const failingStore: Store = {
        id: 'failing',
        consume: vi.fn(),
        peek: async () => {
          throw new Error('Raw store peek failure');
        },
        reset: vi.fn(),
        close: vi.fn(),
      };

      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store: failingStore,
        prefix: 'api',
        config: validConfig,
      });

      const decision = await limiter.peek('user');
      expect(decision.allowed).toBe(true);
      expect(decision.degraded).toBe(true);
    });

    it('reset delegates to store.reset', async () => {
      const store = createMemoryStore({ clock });
      const limiter = createLimiter({
        algorithm: counterAlgorithm,
        store,
        prefix: 'api',
        config: validConfig,
      });

      await limiter.check('user');
      expect(store.size()).toBe(1);

      await limiter.reset('user');
      expect(store.size()).toBe(0);
    });
  });
});
