import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../memory-store.js';
import { StoreError } from '../errors.js';
import { counterAlgorithm, createTestClock } from './test-helpers.js';
import { type Algorithm, type Decision } from '../types.js';

describe('MemoryStore', () => {
  it('basic consume returns expected Decision', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 10, windowMs: 1000 };

    const decision = await store.consume(counterAlgorithm, 'user:1', config, 1);
    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(10);
    expect(decision.remaining).toBe(9);
    expect(decision.retryAfterMs).toBe(0);
    expect(decision.degraded).toBe(false);
  });

  it('respects exact TTL boundaries (alive at ttl-1, expired at ttl)', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 2, windowMs: 1000 };

    // T = 1000: consume 1 (expires at 2000)
    await store.consume(counterAlgorithm, 'user:1', config, 1);

    // T = 1999: still alive, consumes 2nd token
    clock.set(1999);
    const d2 = await store.consume(counterAlgorithm, 'user:1', config, 1);
    expect(d2.allowed).toBe(true);
    expect(d2.remaining).toBe(0);

    // T = 2000: expired! Count resets to 0, cost 1 is allowed
    clock.set(2000);
    const d3 = await store.consume(counterAlgorithm, 'user:1', config, 1);
    expect(d3.allowed).toBe(true);
    expect(d3.remaining).toBe(1);
  });

  it('lazy expiry treats expired entry as absent on read', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 1, windowMs: 500 };

    await store.consume(counterAlgorithm, 'user:1', config, 1);
    clock.advance(600); // Now 1600 (expired at 1500)

    const peekDecision = await store.peek(counterAlgorithm, 'user:1', config);
    expect(peekDecision.allowed).toBe(true);
    expect(peekDecision.remaining).toBe(1);
  });

  it('sweep() purges expired entries and returns count', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 10, windowMs: 500 };

    await store.consume(counterAlgorithm, 'user:1', config, 1);
    await store.consume(counterAlgorithm, 'user:2', config, 1);
    expect(store.size()).toBe(2);

    clock.advance(600);
    // Add a fresh entry
    await store.consume(counterAlgorithm, 'user:3', config, 1);
    expect(store.size()).toBe(3);

    const purged = store.sweep();
    expect(purged).toBe(2);
    expect(store.size()).toBe(1);
    expect(store.stats().sweeps).toBe(1);
  });

  it('triggers incremental sweep after sweepIntervalOps operations', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({
      clock,
      sweepIntervalOps: 5,
      sweepBatchSize: 10,
    });
    const config = { limit: 10, windowMs: 100 };

    // Create 3 entries that expire soon
    await store.consume(counterAlgorithm, 'u1', config, 1);
    await store.consume(counterAlgorithm, 'u2', config, 1);
    await store.consume(counterAlgorithm, 'u3', config, 1);

    clock.advance(200); // all 3 are expired

    // 4th op
    await store.peek(counterAlgorithm, 'u4', config);
    expect(store.stats().sweeps).toBe(0);

    // 5th op triggers incremental sweep
    await store.peek(counterAlgorithm, 'u5', config);
    expect(store.stats().sweeps).toBe(1);
    // Expired entries were swept
    expect(store.size()).toBe(0);
  });

  it('enforces maxKeys cap and evicts LRU entry', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock, maxKeys: 3 });
    const config = { limit: 10, windowMs: 100_000 };

    await store.consume(counterAlgorithm, 'k1', config, 1);
    await store.consume(counterAlgorithm, 'k2', config, 1);
    await store.consume(counterAlgorithm, 'k3', config, 1);

    expect(store.size()).toBe(3);

    // Adding 4th key when maxKeys=3 evicts LRU ('k1')
    await store.consume(counterAlgorithm, 'k4', config, 1);
    expect(store.size()).toBe(3);
    expect(store.stats().evictions).toBe(1);

    // k1 was evicted, so consuming k1 starts fresh
    const dK1 = await store.consume(counterAlgorithm, 'k1', config, 1);
    expect(dK1.remaining).toBe(9);
    // That eviction evicted 'k2' (the oldest remaining)
    expect(store.stats().evictions).toBe(2);
  });

  it('ensureCapacity purges expired entries first before LRU eviction', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock, maxKeys: 2 });
    const config = { limit: 10, windowMs: 500 };

    await store.consume(counterAlgorithm, 'k1', config, 1); // expires at 1500
    await store.consume(counterAlgorithm, 'k2', { limit: 10, windowMs: 10_000 }, 1); // expires at 11000

    expect(store.size()).toBe(2);

    clock.set(1600); // k1 is expired, k2 is active

    // Adding k3 when full: should purge expired k1, so evictions remains 0!
    await store.consume(counterAlgorithm, 'k3', config, 1);
    expect(store.size()).toBe(2);
    expect(store.stats().evictions).toBe(0);

    // k2 should still be present
    const k2Peek = await store.peek(counterAlgorithm, 'k2', { limit: 10, windowMs: 10_000 });
    expect(k2Peek.remaining).toBe(9);
  });

  it('consume promotes entry in LRU ordering', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock, maxKeys: 3 });
    const config = { limit: 10, windowMs: 100_000 };

    await store.consume(counterAlgorithm, 'k1', config, 1);
    await store.consume(counterAlgorithm, 'k2', config, 1);
    await store.consume(counterAlgorithm, 'k3', config, 1);

    // Access k1, making k2 the LRU
    await store.consume(counterAlgorithm, 'k1', config, 1);

    // Add k4 -> should evict k2, not k1
    await store.consume(counterAlgorithm, 'k4', config, 1);

    // k1 should still have remaining = 8 (not evicted)
    const k1Peek = await store.peek(counterAlgorithm, 'k1', config);
    expect(k1Peek.remaining).toBe(8);
  });

  it('peek() is pure: does not promote in LRU or modify state', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock, maxKeys: 3 });
    const config = { limit: 10, windowMs: 100_000 };

    await store.consume(counterAlgorithm, 'k1', config, 1);
    await store.consume(counterAlgorithm, 'k2', config, 1);
    await store.consume(counterAlgorithm, 'k3', config, 1);

    // Peek k1 -> does NOT promote k1
    await store.peek(counterAlgorithm, 'k1', config);

    // Add k4 -> should evict k1 (since k1 was not promoted)
    await store.consume(counterAlgorithm, 'k4', config, 1);

    // k1 was evicted, so peek returns default fresh remaining = 10
    const k1Peek = await store.peek(counterAlgorithm, 'k1', config);
    expect(k1Peek.remaining).toBe(10);
  });

  it('reset() deletes the entry and handles non-existent keys cleanly', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 10, windowMs: 10_000 };

    await store.consume(counterAlgorithm, 'k1', config, 1);
    expect(store.size()).toBe(1);

    await store.reset('k1');
    expect(store.size()).toBe(0);

    // Resetting unknown key does not throw
    await expect(store.reset('unknown-key')).resolves.toBeUndefined();
  });

  it('close() terminates store and subsequent calls throw StoreError', async () => {
    const store = createMemoryStore();
    const config = { limit: 10, windowMs: 10_000 };

    await store.close();

    await expect(store.consume(counterAlgorithm, 'k1', config, 1)).rejects.toThrow(StoreError);
    await expect(store.peek(counterAlgorithm, 'k1', config)).rejects.toThrow(StoreError);
    await expect(store.reset('k1')).rejects.toThrow(StoreError);

    // Calling close twice is safe
    await expect(store.close()).resolves.toBeUndefined();
  });

  it('wraps algorithm step() errors into StoreError and preserves state', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 10, windowMs: 10_000 };

    // Establish good state
    await store.consume(counterAlgorithm, 'k1', config, 1);

    // Broken algorithm that throws during step()
    const brokenAlgorithm: Algorithm<typeof config, unknown> = {
      ...counterAlgorithm,
      step() {
        throw new Error('Explosion in algorithm step');
      },
    };

    await expect(store.consume(brokenAlgorithm, 'k1', config, 1)).rejects.toThrow(StoreError);

    // Verify existing state was NOT corrupted
    const peek = await store.peek(counterAlgorithm, 'k1', config);
    expect(peek.remaining).toBe(9);
  });

  it('state version mismatch treats entry as absent and resets', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 10, windowMs: 10_000 };

    // Consumed with version 1
    await store.consume(counterAlgorithm, 'k1', config, 5);

    // Now call with algorithm version 2
    const v2Algorithm: Algorithm<typeof config, unknown> = {
      ...counterAlgorithm,
      stateVersion: 2,
    };

    const peek = await store.peek(v2Algorithm, 'k1', config);
    expect(peek.remaining).toBe(10); // reset to absent

    const d = await store.consume(v2Algorithm, 'k1', config, 1);
    expect(d.remaining).toBe(9); // fresh start
  });

  it('handles 1,000 concurrent consume calls atomically with exact count', async () => {
    const clock = createTestClock(1000);
    const store = createMemoryStore({ clock });
    const config = { limit: 100, windowMs: 10_000 };

    const promises: Array<Promise<Decision>> = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(store.consume(counterAlgorithm, 'concurrent-key', config, 1));
    }

    const results = await Promise.all(promises);
    const allowedCount = results.filter((r) => r.allowed).length;
    const deniedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(100);
    expect(deniedCount).toBe(900);
  });

  it('default clock works without options', async () => {
    const store = createMemoryStore();
    const config = { limit: 5, windowMs: 5000 };
    const d = await store.consume(counterAlgorithm, 'key', config, 1);
    expect(d.allowed).toBe(true);
  });
});
