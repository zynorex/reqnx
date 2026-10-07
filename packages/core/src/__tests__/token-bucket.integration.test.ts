import { describe, expect, it } from 'vitest';
import { createLimiter } from '../limiter.js';
import { createMemoryStore } from '../memory-store.js';
import { tokenBucket, type TokenBucketInput } from '../algorithms/token-bucket.js';
import { FakeClock } from '../../../testkit/src/fake-clock.js';

describe('tokenBucket — End-to-End Integration with createLimiter & MemoryStore', () => {
  it('admits exactly 20 out of 1,000 simultaneous check() calls at one instant on capacity-20 bucket', async () => {
    const clock = new FakeClock(1000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: tokenBucket,
      store,
      prefix: 'test-simultaneous',
      config: {
        capacity: 20,
        refillTokens: 1,
        refillInterval: '1s',
      },
    });

    const promises = Array.from({ length: 1000 }, () => limiter.check('user-1'));
    const results = await Promise.all(promises);

    const allowedCount = results.filter((r) => r.allowed).length;
    const deniedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(20);
    expect(deniedCount).toBe(980);

    // Remaining on the last admitted check is 0, retryAfterMs on denied is > 0
    const peek = await limiter.peek('user-1');
    expect(peek.remaining).toBe(0);
    expect(peek.allowed).toBe(false);
  });

  it('sustained load at twice the rate over 10 simulated seconds admits exactly predicted tokens', async () => {
    const clock = new FakeClock(0);
    const store = createMemoryStore({ clock });
    // Capacity 10, refill rate 5 tokens per 1000ms (1 token every 200ms)
    const limiter = createLimiter({
      algorithm: tokenBucket,
      store,
      prefix: 'test-sustained',
      config: {
        capacity: 10,
        refillTokens: 5,
        refillInterval: 1000,
      },
    });

    // We send requests at twice the rate: 10 requests per second (1 request every 100ms) for 10 seconds = 100 requests.
    // Initial burst at t=0 drains 10 tokens.
    // Over the next 10 seconds (10,000 ms), 50 tokens refill (5 per second * 10 seconds).
    // Total admitted should be exactly 10 (initial burst) + 50 (refill) = 60 tokens!
    let totalAdmitted = 0;
    let totalDenied = 0;

    for (let t = 0; t <= 10_000; t += 100) {
      clock.set(t);
      const dec = await limiter.check('user-sustained', { cost: 1 });
      if (dec.allowed) {
        totalAdmitted++;
      } else {
        totalDenied++;
      }
    }

    expect(totalAdmitted).toBe(60);
    expect(totalDenied).toBe(41); // 101 total requests (t=0 to 10000 step 100) - 60 admitted
  });

  it('entry expiry behaves identically to an absent key / full bucket', async () => {
    const clock = new FakeClock(1000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: tokenBucket,
      store,
      prefix: 'test-expiry',
      config: {
        capacity: 5,
        refillTokens: 1,
        refillInterval: '1s', // fullRefillMs = 5000 ms
      },
    });

    // Drain all 5 tokens at t=1000
    for (let i = 0; i < 5; i++) {
      const dec = await limiter.check('key-expiry');
      expect(dec.allowed).toBe(true);
    }
    const drainedPeek = await limiter.peek('key-expiry');
    expect(drainedPeek.remaining).toBe(0);

    // Advance time past TTL (1000 + 5000 = 6000) to 6001
    clock.set(6001);

    // State in store is expired; peek must report full capacity (5 tokens)
    const expiredPeek = await limiter.peek('key-expiry');
    expect(expiredPeek.remaining).toBe(5);
    expect(expiredPeek.allowed).toBe(true);

    // Fresh check should admit full cost up to 5
    const dec = await limiter.check('key-expiry', { cost: 5 });
    expect(dec.allowed).toBe(true);
    expect(dec.remaining).toBe(0);
  });

  it('guarantees per-key isolation', async () => {
    const clock = new FakeClock(1000);
    const store = createMemoryStore({ clock });
    const limiter = createLimiter({
      algorithm: tokenBucket,
      store,
      prefix: 'test-isolation',
      config: {
        capacity: 5,
        refillTokens: 1,
        refillInterval: '1s',
      },
    });

    // Drain key-A
    for (let i = 0; i < 5; i++) {
      await limiter.check('key-A');
    }
    const decA = await limiter.check('key-A');
    expect(decA.allowed).toBe(false);

    // key-B should remain untouched and completely full
    const peekB = await limiter.peek('key-B');
    expect(peekB.remaining).toBe(5);
    const decB = await limiter.check('key-B');
    expect(decB.allowed).toBe(true);
    expect(decB.remaining).toBe(4);
  });

  it('async config resolver dynamic changes follow config-change policy', async () => {
    const clock = new FakeClock(1000);
    const store = createMemoryStore({ clock });

    let tier: 'standard' | 'pro' = 'standard';
    const limiter = createLimiter({
      algorithm: tokenBucket,
      store,
      prefix: 'test-resolver',
      resolver: async (_key): Promise<TokenBucketInput> => {
        if (tier === 'pro') {
          return {
            capacity: 20,
            refillTokens: 5,
            refillInterval: '1s',
          };
        }
        return {
          capacity: 5,
          refillTokens: 1,
          refillInterval: '1s',
        };
      },
    });

    // Standard tier: drain 4 tokens from 5
    for (let i = 0; i < 4; i++) {
      await limiter.check('tenant-1');
    }
    const standardPeek = await limiter.peek('tenant-1');
    expect(standardPeek.remaining).toBe(1);

    // Upgrade to Pro tier at the exact same instant
    tier = 'pro';

    // Per config-change policy: capacity increase does not grant instant headroom!
    // Stored whole tokens remain 1!
    const upgradedPeek = await limiter.peek('tenant-1');
    expect(upgradedPeek.remaining).toBe(1);
    expect(upgradedPeek.limit).toBe(20);

    // Consume the 1 remaining token
    const admit1 = await limiter.check('tenant-1');
    expect(admit1.allowed).toBe(true);
    expect(admit1.remaining).toBe(0);

    // Denied now
    const admit2 = await limiter.check('tenant-1');
    expect(admit2.allowed).toBe(false);

    // Advance 1s: refills at Pro rate (5 tokens per second)
    clock.set(2000);
    const refillPeek = await limiter.peek('tenant-1');
    expect(refillPeek.remaining).toBe(5);
  });
});
