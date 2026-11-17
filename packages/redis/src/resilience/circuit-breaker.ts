// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Circuit Breaker
//
// Fast-failing state machine protecting downstream Redis during outages.
// Transitions between closed, open, and half-open states with an injectable Clock.
// ──────────────────────────────────────────────────────────────────────────────

import { type Clock } from '@reqnx/core';
import { RedisStoreError } from '../adapters/base.js';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Number of qualifying failures within `windowMs` required to open the circuit. Default: 5. */
  readonly failureThreshold?: number;
  /** Rolling evaluation window in milliseconds for failure threshold. Default: 10,000ms. */
  readonly windowMs?: number;
  /** Milliseconds the breaker remains open before transitioning to half-open. Default: 5,000ms. */
  readonly cooldownMs?: number;
  /** Number of probe requests allowed through in half-open state. Default: 1. */
  readonly halfOpenProbes?: number;
  /** Injectable Clock instance for deterministic testing without sleeps. */
  readonly clock?: Clock;
}

export class CircuitBreaker {
  private _state: CircuitBreakerState = 'closed';
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly halfOpenProbes: number;
  private readonly clock: Clock;

  private failureTimestamps: number[] = [];
  private lastOpenedAtMs = 0;
  private halfOpenAttempts = 0;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.windowMs = options?.windowMs ?? 10_000;
    this.cooldownMs = options?.cooldownMs ?? 5_000;
    this.halfOpenProbes = options?.halfOpenProbes ?? 1;
    this.clock = options?.clock ?? { nowMs: () => Date.now() };
  }

  public get state(): CircuitBreakerState {
    this.checkCooldownTransition();
    return this._state;
  }

  /**
   * Determine whether an error classifies as a system failure that should trip the breaker.
   *
   * Network disconnects, connection errors, timeouts, and replica readonly rejections
   * count as system failures. User input errors, malformed keys, corrupt state, and Lua
   * syntax bugs never count because they reflect client-side bugs, not Redis health.
   */
  public isQualifyingFailure(err: unknown): boolean {
    if (err instanceof RedisStoreError) {
      const code = err.code as string;
      return (
        code === 'timeout' ||
        code === 'REQNX_COMMAND_TIMEOUT' ||
        code === 'connection' ||
        code === 'REQNX_CONNECTION_ERROR' ||
        code === 'readonly' ||
        code === 'REQNX_READONLY'
      );
    }

    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      return (
        msg.includes('econnrefused') ||
        msg.includes('econnreset') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('readonly')
      );
    }

    return false;
  }

  /**
   * Pre-flight check called before dispatching a command to Redis.
   *
   * Rejects immediately with `RedisStoreError` (code `'circuit-open'`) if the circuit is open.
   */
  public beforeCall(): void {
    this.checkCooldownTransition();

    if (this._state === 'open') {
      throw new RedisStoreError(
        `RedisStore circuit breaker is OPEN (tripped by consecutive failures). Fast-failing in 0ms without dispatching to Redis.`,
        { code: 'circuit-open' },
      );
    }

    if (this._state === 'half-open') {
      if (this.halfOpenAttempts >= this.halfOpenProbes) {
        throw new RedisStoreError(
          `RedisStore circuit breaker is HALF-OPEN (probe budget of ${this.halfOpenProbes} reached). Fast-failing in 0ms.`,
          { code: 'circuit-open' },
        );
      }
      this.halfOpenAttempts++;
    }
  }

  /**
   * Record a successful Redis response.
   *
   * If in half-open state, success confirms recovery and closes the circuit.
   */
  public onSuccess(): void {
    if (this._state === 'half-open') {
      this._state = 'closed';
      this.failureTimestamps = [];
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Record a Redis failure.
   */
  public onError(err: unknown): void {
    if (!this.isQualifyingFailure(err)) {
      return;
    }

    const now = this.clock.nowMs();

    if (this._state === 'half-open') {
      // Probe failed: immediately return to open state
      this._state = 'open';
      this.lastOpenedAtMs = now;
      this.halfOpenAttempts = 0;
      return;
    }

    if (this._state === 'closed') {
      this.failureTimestamps.push(now);

      // Prune failures outside the window
      const cutoff = now - this.windowMs;
      this.failureTimestamps = this.failureTimestamps.filter((t) => t >= cutoff);

      if (this.failureTimestamps.length >= this.failureThreshold) {
        this._state = 'open';
        this.lastOpenedAtMs = now;
        this.halfOpenAttempts = 0;
      }
    }
  }

  private checkCooldownTransition(): void {
    if (this._state === 'open') {
      const now = this.clock.nowMs();
      if (now - this.lastOpenedAtMs >= this.cooldownMs) {
        this._state = 'half-open';
        this.halfOpenAttempts = 0;
      }
    }
  }
}
