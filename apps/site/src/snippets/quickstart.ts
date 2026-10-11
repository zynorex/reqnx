import { createLimiter, createMemoryStore, fixedWindow } from '@reqnx/core';
import type { Clock } from '@reqnx/core';

// Anchor clock deterministically at 1,000ms (1s into a 10s epoch window)
const defaultClock: Clock = {
  nowMs: () => 1_000,
};

export async function executeQuickstart(clock: Clock = defaultClock) {
  // 1. Initialise in-memory store
  const store = createMemoryStore({ clock });

  // 2. Configure rate limiter instance
  const limiter = createLimiter({
    algorithm: fixedWindow,
    store,
    prefix: 'api',
    config: {
      limit: 5,
      window: '10s',
    },
  });

  // 3. Evaluate requests for a user
  const results = [];
  for (let i = 0; i < 7; i++) {
    const decision = await limiter.check('user:1042');
    results.push({
      request: i + 1,
      allowed: decision.allowed,
      limit: decision.limit,
      remaining: decision.remaining,
      retryAfterMs: decision.retryAfterMs,
      degraded: decision.degraded,
    });
  }
  return results;
}
