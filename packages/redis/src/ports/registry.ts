// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/redis — Algorithm Ports Registry
//
// Registry mapping AlgorithmId to its corresponding AlgorithmRedisPort.
// ──────────────────────────────────────────────────────────────────────────────

import { type AlgorithmId } from '@reqnx/core';
import { type AlgorithmRedisPort } from '../types.js';
import { fixedWindowRedisPort } from './fixed-window.js';
import { tokenBucketRedisPort } from './token-bucket.js';
import { slidingWindowLogRedisPort } from './sliding-window-log.js';
import { slidingWindowCounterRedisPort } from './sliding-window-counter.js';
import { RedisStoreError } from '../adapters/base.js';

export class PortRegistry {
  private readonly ports = new Map<AlgorithmId, AlgorithmRedisPort<never, never>>();

  constructor(initialPorts?: readonly AlgorithmRedisPort<never, never>[]) {
    // Register built-in ports
    this.register(fixedWindowRedisPort as unknown as AlgorithmRedisPort<never, never>);
    this.register(tokenBucketRedisPort as unknown as AlgorithmRedisPort<never, never>);
    this.register(slidingWindowLogRedisPort as unknown as AlgorithmRedisPort<never, never>);
    this.register(slidingWindowCounterRedisPort as unknown as AlgorithmRedisPort<never, never>);

    // Register user/custom ports
    if (initialPorts) {
      for (const port of initialPorts) {
        this.register(port);
      }
    }
  }

  register<C = unknown, S = unknown>(port: AlgorithmRedisPort<C, S>): void {
    this.ports.set(port.algorithmId, port as unknown as AlgorithmRedisPort<never, never>);
  }

  get<C = unknown, S = unknown>(id: AlgorithmId): AlgorithmRedisPort<C, S> {
    const port = this.ports.get(id);
    if (!port) {
      throw new RedisStoreError(
        `No Redis Lua port registered for algorithm '${id}'. Registered algorithms: ${Array.from(this.ports.keys()).join(', ')}.`,
        { code: 'REQNX_UNSUPPORTED_ALGORITHM' },
      );
    }
    return port as unknown as AlgorithmRedisPort<C, S>;
  }

  getAll(): AlgorithmRedisPort<never, never>[] {
    return Array.from(this.ports.values());
  }
}
