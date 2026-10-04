// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/testkit — Test algorithm fixtures
//
// These are test-only algorithms used to verify store implementations and
// conformance suites. They are NOT exported from @reqnx/core.
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type AlgorithmId, type Decision, ConfigError } from '@reqnx/core';

export interface CounterConfig {
  readonly limit: number;
  readonly windowMs: number;
}

export interface CounterState {
  readonly count: number;
}

/**
 * A simple counter algorithm for testing stores and harnesses.
 * Counts up to `limit` requests within a fixed `windowMs`.
 * Relies on the store to discard expired state.
 */
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
    if (typeof limit !== 'number' || limit <= 0 || !Number.isInteger(limit)) {
      throw new ConfigError('limit must be a positive integer');
    }
    if (typeof windowMs !== 'number' || windowMs <= 0 || !Number.isInteger(windowMs)) {
      throw new ConfigError('windowMs must be a positive integer');
    }
    return { limit, windowMs };
  },

  step(
    currentState: CounterState | undefined,
    config: CounterConfig,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: CounterState } {
    const currentCount = currentState?.count ?? 0;
    const nextCount = currentCount + cost;
    const allowed = nextCount <= config.limit;
    const remaining = Math.max(0, config.limit - nextCount);
    const retryAfterMs = allowed ? 0 : config.windowMs;

    return {
      decision: {
        allowed,
        limit: config.limit,
        remaining,
        resetAtMs: nowMs + config.windowMs,
        retryAfterMs,
        degraded: false,
      },
      nextState: {
        count: nextCount,
      },
    };
  },

  peek(currentState: CounterState | undefined, config: CounterConfig, nowMs: number): Decision {
    const currentCount = currentState?.count ?? 0;
    const allowed = currentCount < config.limit;
    const remaining = Math.max(0, config.limit - currentCount);
    const retryAfterMs = allowed ? 0 : config.windowMs;

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAtMs: nowMs + config.windowMs,
      retryAfterMs,
      degraded: false,
    };
  },

  stateTtlMs(config: CounterConfig): number {
    return config.windowMs;
  },
};

export interface AllowAllConfig {
  readonly limit?: number;
}

/**
 * A dummy algorithm that always allows every request.
 */
export const allowAllAlgorithm: Algorithm<AllowAllConfig, Record<string, never>> = {
  id: 'allow-all' as unknown as AlgorithmId,
  stateVersion: 1,

  parseConfig(raw: unknown): AllowAllConfig {
    if (raw !== undefined && (typeof raw !== 'object' || raw === null)) {
      throw new ConfigError('Config must be an object if provided');
    }
    return {};
  },

  step(
    _state: Record<string, never> | undefined,
    _config: AllowAllConfig,
    nowMs: number,
    _cost: number,
  ) {
    return {
      decision: {
        allowed: true,
        limit: 1000,
        remaining: 1000,
        resetAtMs: nowMs + 1000,
        retryAfterMs: 0,
        degraded: false,
      },
      nextState: {},
    };
  },

  peek(_state: Record<string, never> | undefined, _config: AllowAllConfig, nowMs: number) {
    return {
      allowed: true,
      limit: 1000,
      remaining: 1000,
      resetAtMs: nowMs + 1000,
      retryAfterMs: 0,
      degraded: false,
    };
  },

  stateTtlMs(): number {
    return 1000;
  },
};
