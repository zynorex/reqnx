// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Public API barrel
// ──────────────────────────────────────────────────────────────────────────────

// Types (re-exported for consumers)
export type {
  Duration,
  Clock,
  Decision,
  AlgorithmId,
  Algorithm,
  Store,
  StoreErrorContext,
  StoreErrorPolicy,
  LimiterHooks,
  DecisionEvent,
  ErrorEvent,
  ConfigResolver,
  LimiterOptions,
  CheckOptions,
  Limiter,
  HeaderOptions,
  RateLimitHeaders,
} from './types.js';

// Error classes
export { ConfigError, StoreError } from './errors.js';

// Clock
export { SystemClock } from './clock.js';

// Duration
export { parseDuration } from './duration.js';

// Key utilities
export { MAX_KEY_BYTES, buildKey } from './keys.js';

// Headers
export { decisionToHeaders } from './headers.js';

// Limiter factory
export { createLimiter } from './limiter.js';
