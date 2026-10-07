import { bench, describe } from 'vitest';
import {
  tokenBucket,
  type TokenBucketState,
} from '../algorithms/token-bucket.js';
import { createMemoryStore } from '../memory-store.js';
import { createLimiter } from '../limiter.js';

describe('tokenBucket — pure algorithm', () => {
  const config = tokenBucket.parseConfig({
    capacity: 1000,
    refillTokens: 100,
    refillInterval: '1s',
  });
  let state: TokenBucketState | undefined;
  let nowMs = 1_000_000;

  bench('parseConfig per call (resolver path)', () => {
    tokenBucket.parseConfig({
      capacity: 1000,
      refillTokens: 100,
      refillInterval: '1s',
    });
  });

  bench('step() on fresh state', () => {
    tokenBucket.step(undefined, config, nowMs, 1);
  });

  bench('step() on existing state (accumulating & refilling)', () => {
    nowMs += 10;
    state = tokenBucket.step(state, config, nowMs, 1).nextState;
  });

  bench('peek() on existing state', () => {
    tokenBucket.peek(state, config, nowMs);
  });
});

describe('tokenBucket + createLimiter + createMemoryStore', () => {
  const storeHot = createMemoryStore();
  const limiterHot = createLimiter({
    algorithm: tokenBucket,
    store: storeHot,
    prefix: 'bench-tb-hot',
    config: { capacity: 1_000_000_000, refillTokens: 100_000, refillInterval: '1s' },
  });

  bench('limiter.check() with single hot key', async () => {
    await limiterHot.check('hotkey');
  });

  const store100k = createMemoryStore({ maxKeys: 150_000 });
  const limiter100k = createLimiter({
    algorithm: tokenBucket,
    store: store100k,
    prefix: 'bench-tb-100k',
    config: { capacity: 100, refillTokens: 10, refillInterval: '1s' },
  });

  let counter = 0;
  bench('limiter.check() with 100k rotating keys', async () => {
    const key = `user-${counter % 100_000}`;
    counter++;
    await limiter100k.check(key);
  });
});
