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
  private readonly ports = new Map<AlgorithmId, AlgorithmRedisPort<any, any>>();

  constructor(initialPorts?: readonly AlgorithmRedisPort<any, any>[]) {
    // Register built-in ports
    this.register(fixedWindowRedisPort);
    this.register(tokenBucketRedisPort);
    this.register(slidingWindowLogRedisPort);
    this.register(slidingWindowCounterRedisPort);

    // Register user/custom ports
    if (initialPorts) {
      for (const port of initialPorts) {
        this.register(port);
      }
    }
  }

  register(port: AlgorithmRedisPort<any, any>): void {
    this.ports.set(port.algorithmId, port);
  }

  get(id: AlgorithmId): AlgorithmRedisPort<any, any> {
    const port = this.ports.get(id);
    if (!port) {
      throw new RedisStoreError(
        `No Redis Lua port registered for algorithm '${id}'. Registered algorithms: ${Array.from(this.ports.keys()).join(', ')}.`,
        { code: 'REQNX_UNSUPPORTED_ALGORITHM' },
      );
    }
    return port;
  }

  getAll(): AlgorithmRedisPort<any, any>[] {
    return Array.from(this.ports.values());
  }
}
