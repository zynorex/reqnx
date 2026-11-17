// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Circuit Breaker Unit Tests (Deterministic with FakeClock)
// ──────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { FakeClock } from '@reqnx/testkit';
import { CircuitBreaker } from '../circuit-breaker.js';
import { RedisStoreError } from '../../adapters/base.js';

describe('CircuitBreaker (State Machine)', () => {
  it('starts in closed state', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({ clock });
    expect(cb.state).toBe('closed');
  });

  it('remains closed when failures stay below threshold', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({ clock, failureThreshold: 3 });

    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    expect(cb.state).toBe('closed');
  });

  it('opens when qualifying failures meet threshold within window', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({
      clock,
      failureThreshold: 3,
      windowMs: 5000,
    });

    cb.onError(new RedisStoreError('Connection error', { code: 'connection' }));
    cb.onError(new RedisStoreError('Connection error', { code: 'connection' }));
    expect(cb.state).toBe('closed');

    // Third failure trips the breaker
    cb.onError(new RedisStoreError('Connection error', { code: 'connection' }));
    expect(cb.state).toBe('open');

    // Rejects immediately
    expect(() => cb.beforeCall()).toThrow(RedisStoreError);
    try {
      cb.beforeCall();
    } catch (err: unknown) {
      expect((err as RedisStoreError).code).toBe('circuit-open');
    }
  });

  it('does not count non-qualifying errors (invalid argument, corrupt state, script errors)', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({ clock, failureThreshold: 2 });

    cb.onError(new RedisStoreError('Bad argument', { code: 'REQNX_INVALID_ARGUMENT' }));
    cb.onError(new RedisStoreError('Corrupt hash', { code: 'REQNX_CORRUPT_STATE' }));
    cb.onError(new RedisStoreError('Script bug', { code: 'REQNX_SCRIPT_ERROR' }));

    expect(cb.state).toBe('closed');
  });

  it('prunes failures older than windowMs', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({
      clock,
      failureThreshold: 2,
      windowMs: 2000,
    });

    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    // Advance past window
    clock.advance(3000);

    // Second failure arrived after first failure expired
    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    expect(cb.state).toBe('closed');
  });

  it('transitions from open to half-open after cooldownMs', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({
      clock,
      failureThreshold: 1,
      cooldownMs: 3000,
    });

    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    expect(cb.state).toBe('open');

    // Advance 2s (still open)
    clock.advance(2000);
    expect(cb.state).toBe('open');

    // Advance past 3s cooldown -> becomes half-open
    clock.advance(1001);
    expect(cb.state).toBe('half-open');
  });

  it('half-open: admits probe requests and closes on success', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({
      clock,
      failureThreshold: 1,
      cooldownMs: 2000,
      halfOpenProbes: 1,
    });

    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    expect(cb.state).toBe('open');

    clock.advance(2000);
    expect(cb.state).toBe('half-open');

    // Probe 1 is allowed
    expect(() => cb.beforeCall()).not.toThrow();

    // Probe 2 exceeds budget
    expect(() => cb.beforeCall()).toThrow(RedisStoreError);

    // Probe 1 succeeds!
    cb.onSuccess();
    expect(cb.state).toBe('closed');
  });

  it('half-open: probe failure immediately re-opens circuit', () => {
    const clock = new FakeClock(1000);
    const cb = new CircuitBreaker({
      clock,
      failureThreshold: 1,
      cooldownMs: 2000,
    });

    cb.onError(new RedisStoreError('Timeout', { code: 'timeout' }));
    clock.advance(2000);
    expect(cb.state).toBe('half-open');

    // Probe fails
    cb.onError(new RedisStoreError('Connection lost', { code: 'connection' }));
    expect(cb.state).toBe('open');
  });
});
