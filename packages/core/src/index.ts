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

// MemoryStore types & factory
export type { MemoryStore, MemoryStoreOptions, MemoryStoreStats } from './memory-store.js';
export { createMemoryStore } from './memory-store.js';

// Error classes
export { RateLimitError, ConfigError, StoreError, InputError } from './errors.js';

// Clock
export { SystemClock } from './clock.js';

// Duration
export { parseDuration } from './duration.js';

// Key utilities
export type { KeyOptions } from './keys.js';
export { MAX_KEY_BYTES, buildKey, validateKey, validatePrefix, validateIdentity } from './keys.js';

// Headers
export { decisionToHeaders } from './headers.js';

// Limiter factory
export { createLimiter } from './limiter.js';
