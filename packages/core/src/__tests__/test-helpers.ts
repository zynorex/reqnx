import { type Algorithm, type AlgorithmId, type Clock, type Decision } from '../types.js';
import { ConfigError } from '../errors.js';

export interface TestClock extends Clock {
  advance(ms: number): void;
  set(ms: number): void;
}

export function createTestClock(initialMs = 1_000_000): TestClock {
  let currentMs = initialMs;
  return {
    nowMs(): number {
      return currentMs;
    },
    advance(ms: number): void {
      currentMs += ms;
    },
    set(ms: number): void {
      currentMs = ms;
    },
  };
}

export interface CounterConfig {
  limit: number;
  windowMs: number;
}

export interface CounterState {
  count: number;
  expiresAt: number;
}

export const counterAlgorithm: Algorithm<CounterConfig, CounterState> = {
  id: 'counter' as unknown as AlgorithmId,
  stateVersion: 1,

  parseConfig(raw: unknown): CounterConfig {
    if (!raw || typeof raw !== 'object') {
      throw new ConfigError('Config must be an object');
    }
    const c = raw as Record<string, unknown>;
    const limit = c['limit'];
    const windowMs = c['windowMs'];
    if (typeof limit !== 'number' || limit <= 0) {
      throw new ConfigError('limit must be a positive number');
    }
    if (typeof windowMs !== 'number' || windowMs <= 0) {
      throw new ConfigError('windowMs must be a positive number');
    }
    return { limit, windowMs };
  },

  step(
    currentState: CounterState | undefined,
    config: CounterConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: CounterState } {
    const isNewOrExpired = !currentState || nowMs >= currentState.expiresAt;
    const currentCount = isNewOrExpired ? 0 : currentState.count;
    const expiresAt = isNewOrExpired ? nowMs + config.windowMs : currentState.expiresAt;

    const nextCount = currentCount + cost;
    const allowed = nextCount <= config.limit;
    const remaining = Math.max(0, config.limit - nextCount);
    const retryAfterMs = allowed ? 0 : Math.max(0, expiresAt - nowMs);

    return {
      decision: {
        allowed,
        limit: config.limit,
        remaining,
        resetAtMs: expiresAt,
        retryAfterMs,
        degraded: false,
      },
      nextState: {
        count: nextCount,
        expiresAt,
      },
    };
  },

  peek(currentState: CounterState | undefined, config: CounterConfig, nowMs: number): Decision {
    const isNewOrExpired = !currentState || nowMs >= currentState.expiresAt;
    const currentCount = isNewOrExpired ? 0 : currentState.count;
    const expiresAt = isNewOrExpired ? nowMs + config.windowMs : currentState.expiresAt;

    const allowed = currentCount < config.limit;
    const remaining = Math.max(0, config.limit - currentCount);
    const retryAfterMs = allowed ? 0 : Math.max(0, expiresAt - nowMs);

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAtMs: expiresAt,
      retryAfterMs,
      degraded: false,
    };
  },

  stateTtlMs(config: CounterConfig): number {
    return config.windowMs;
  },
};
