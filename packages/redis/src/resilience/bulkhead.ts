// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Bulkhead Concurrency Limiter
//
// Caps concurrent in-flight calls against Redis to protect both the Redis cluster
// and the local Node.js process from memory exhaustion during downstream backpressure.
// ──────────────────────────────────────────────────────────────────────────────

import { RedisStoreError } from '../adapters/base.js';

export interface BulkheadOptions {
  /** Maximum number of simultaneous in-flight Redis calls. 0 disables the cap. */
  readonly maxPending?: number;
}

export class Bulkhead {
  private inFlight = 0;
  private pendingPeak = 0;
  private readonly maxPending: number;

  constructor(options?: BulkheadOptions) {
    this.maxPending = options?.maxPending ?? 0;
  }

  public get currentInFlight(): number {
    return this.inFlight;
  }

  public get peakInFlight(): number {
    return this.pendingPeak;
  }

  /**
   * Acquire a slot before executing an operation.
   * Throws `RedisStoreError` with code `'overloaded'` if `inFlight >= maxPending`.
   */
  public acquire(): void {
    if (this.maxPending > 0 && this.inFlight >= this.maxPending) {
      throw new RedisStoreError(
        `RedisStore bulkhead capacity exceeded (${this.inFlight}/${this.maxPending} calls in flight). Request rejected to prevent connection queue saturation.`,
        { code: 'overloaded' },
      );
    }
    this.inFlight++;
    if (this.inFlight > this.pendingPeak) {
      this.pendingPeak = this.inFlight;
    }
  }

  /**
   * Release an acquired slot after operation finishes.
   */
  public release(): void {
    if (this.inFlight > 0) {
      this.inFlight--;
    }
  }
}
