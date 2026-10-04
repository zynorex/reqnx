import { bench, describe } from 'vitest';
import {
  fixedWindow,
  type FixedWindowConfig,
  type FixedWindowState,
} from '../algorithms/fixed-window.js';
import { createMemoryStore } from '../memory-store.js';
import { createLimiter } from '../limiter.js';

describe('fixedWindow — pure algorithm', () => {
  const config: FixedWindowConfig = { limit: 1000, windowMs: 60_000 };
  let state: FixedWindowState | undefined;
  const nowMs = 1_000_000;

  bench('step() on fresh state', () => {
    fixedWindow.step(undefined, config, nowMs, 1);
  });

  bench('step() on existing state (accumulating)', () => {
    state = fixedWindow.step(state, config, nowMs, 1).nextState;
  });

  bench('peek() on existing state', () => {
    fixedWindow.peek(state, config, nowMs);
  });
});

describe('fixedWindow + createLimiter + createMemoryStore', () => {
  const storeHot = createMemoryStore();
  const limiterHot = createLimiter({
    algorithm: fixedWindow,
    store: storeHot,
    prefix: 'bench-hot',
    config: { limit: 1_000_000_000, window: '1h' },
  });

  bench('limiter.check() with single hot key', async () => {
    await limiterHot.check('hotkey');
  });

  const store100k = createMemoryStore({ maxKeys: 150_000 });
  const limiter100k = createLimiter({
    algorithm: fixedWindow,
    store: store100k,
    prefix: 'bench-100k',
    config: { limit: 100, window: '1h' },
  });

  let counter = 0;
  bench('limiter.check() with 100k rotating keys', async () => {
    const key = `user-${counter % 100_000}`;
    counter++;
    await limiter100k.check(key);
  });
});
