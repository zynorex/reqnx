// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — Core contracts for a pluggable, distributed-ready rate limiter.
//
// This file contains types ONLY. No implementation.
// Algorithms are pure state-transition functions; stores own atomicity & clock.
// ──────────────────────────────────────────────────────────────────────────────

import { type StoreError } from './errors.js';

// ─── Duration ─────────────────────────────────────────────────────────────────

/**
 * A duration expressed as milliseconds (number) or a human-readable string.
 *
 * Supported suffixes:
 * - `ms` — milliseconds
 * - `s`  — seconds
 * - `m`  — minutes
 * - `h`  — hours
 * - `d`  — days
 *
 * @example
 * ```ts
 * const d1: Duration = 5000;        // 5 seconds
 * const d2: Duration = '30s';       // 30 seconds
 * const d3: Duration = '2m';        // 2 minutes
 * const d4: Duration = '500ms';     // 500 milliseconds
 * ```
 */
export type Duration = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

// ─── Clock ────────────────────────────────────────────────────────────────────

/**
 * Injectable clock abstraction.
 *
 * **MemoryStore** calls `clock.nowMs()` to get the current time, allowing
 * tests to inject a {@link FakeClock} for deterministic behaviour.
 *
 * **RedisStore** ignores this entirely and uses Redis server `TIME` inside
 * its Lua scripts, ensuring all app instances agree on the clock regardless
 * of local clock skew.
 */
export interface Clock {
  /** Returns the current time as epoch milliseconds. */
  nowMs(): number;
}

// ─── Decision ─────────────────────────────────────────────────────────────────

/**
 * The outcome of a rate-limit check. This is a plain, immutable value object.
 *
 * A denied request is a normal return value — never an exception.
 *
 * ### Per-algorithm semantics
 *
 * | Field          | Fixed Window                          | Sliding Window Log                    | Sliding Window Counter                | Token Bucket                              | Leaky Bucket                              |
 * |----------------|---------------------------------------|---------------------------------------|---------------------------------------|-------------------------------------------|-------------------------------------------|
 * | `remaining`    | Tokens left in current window         | Tokens left in current window         | Estimated tokens left in window       | Tokens currently available in bucket      | Available slots in the queue              |
 * | `resetAtMs`    | Epoch ms when current window closes   | Epoch ms when oldest entry expires    | Epoch ms when current window closes   | Epoch ms when bucket will be fully refilled| Epoch ms when queue will be fully drained |
 * | `retryAfterMs` | 0 if allowed; ms until window resets  | 0 if allowed; ms until oldest expires | 0 if allowed; ms until window resets  | 0 if allowed; ms until enough tokens refill| 0 if allowed; ms until a slot opens       |
 */
export interface Decision {
  /** Whether the request is allowed. */
  readonly allowed: boolean;

  /** The maximum number of requests/tokens in the configured window/bucket. */
  readonly limit: number;

  /** How many requests/tokens remain after this check. Always ≥ 0. */
  readonly remaining: number;

  /** Epoch ms when the limit fully resets (or bucket fully refills). */
  readonly resetAtMs: number;

  /**
   * Milliseconds until a retry would succeed.
   * - `0` when `allowed` is `true`.
   * - `> 0` when `allowed` is `false`.
   */
  readonly retryAfterMs: number;
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

/**
 * A known algorithm identifier. Each algorithm registers its id so that
 * stores can look up their native implementation (TS step or Lua script).
 *
 * Extensible via TypeScript module augmentation if plugin support is added.
 */
export type AlgorithmId =
  | 'fixed-window'
  | 'sliding-window-log'
  | 'sliding-window-counter'
  | 'token-bucket'
  | 'leaky-bucket';

/**
 * A pure, deterministic state-transition function for a rate-limiting algorithm.
 *
 * ### Purity contract
 * An algorithm must **never**:
 * - Perform I/O
 * - Call `Date.now()` or `performance.now()`
 * - Call `Math.random()`
 * - Throw exceptions during `step()` or `peek()`
 *
 * All non-determinism (clock, storage) is injected by the {@link Store}.
 *
 * ### State versioning
 * The `stateVersion` field is a monotonically increasing integer. Stores use
 * it to detect stale state from a previous code version and reset cleanly
 * instead of deserialising a mismatched shape.
 *
 * @typeParam Config - The validated, algorithm-specific configuration.
 * @typeParam State  - The per-key mutable state shape (versioned via `stateVersion`).
 */
export interface Algorithm<Config, State> {
  /**
   * Unique, stable identifier. Must match one of {@link AlgorithmId}.
   * Used in key schema and Lua script lookup.
   */
  readonly id: AlgorithmId;

  /**
   * Monotonically increasing integer. Bump when the `State` shape changes.
   * Stores use this to detect stale state and reset it instead of crashing
   * on shape mismatches during rolling deploys.
   */
  readonly stateVersion: number;

  /**
   * Validate and normalise raw user input into a typed `Config`.
   *
   * Called once at limiter construction (static config) or per-call
   * (when using a {@link ConfigResolver}).
   *
   * @param input - Raw user-provided configuration.
   * @returns Validated and normalised config.
   * @throws {ConfigError} if the input is invalid.
   */
  parseConfig(input: unknown): Config;

  /**
   * Core state transition: consume `cost` tokens/slots and return the
   * decision plus the next state.
   *
   * @param state  - Current per-key state, or `undefined` for a first-ever request.
   * @param config - Validated configuration (output of `parseConfig`).
   * @param nowMs  - Current time in epoch milliseconds (injected by Store).
   * @param cost   - Number of tokens/slots to consume. Must be ≥ 1.
   * @returns The decision and the new state to persist.
   */
  step(
    state: State | undefined,
    config: Config,
    nowMs: number,
    cost: number,
  ): { readonly decision: Decision; readonly nextState: State };

  /**
   * Read-only check: what would the decision be right now, without consuming?
   *
   * Must **not** mutate state. Returns the decision as if `cost=0`.
   *
   * @param state  - Current per-key state, or `undefined`.
   * @param config - Validated configuration.
   * @param nowMs  - Current time in epoch milliseconds.
   */
  peek(state: State | undefined, config: Config, nowMs: number): Decision;

  /**
   * How long (in ms) should the store retain this key's state before eviction?
   *
   * This drives both MemoryStore TTL sweeps and Redis `PEXPIRE`.
   * Typically `windowMs` for window-based algorithms, or the time to fully
   * refill/drain for bucket algorithms.
   *
   * @param config - Validated configuration.
   */
  stateTtlMs(config: Config): number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * An atomic executor for rate-limit algorithms. The store owns the clock,
 * the per-key state, and the atomicity guarantees.
 *
 * ### Atomicity model
 * - **MemoryStore** runs the TS `step()` function synchronously on a single
 *   thread. As long as nothing is `await`ed between read and write, this is
 *   race-free.
 * - **RedisStore** runs an equivalent Lua script via `EVALSHA`, providing
 *   atomicity across concurrent app instances.
 *
 * ### Not a key-value adapter
 * Stores are **not** generic get/set/incr adapters. They execute a complete
 * check-and-update cycle atomically. This design prevents races that occur
 * with WATCH/retry or separate get+set patterns.
 */
export interface Store {
  /** Human-readable store identifier (e.g. `'memory'`, `'redis'`). */
  readonly id: string;

  /**
   * Atomically execute one consume cycle for the given algorithm and key.
   *
   * @param algorithm - The algorithm whose `step()` (or equivalent Lua) to run.
   * @param key       - The full, prefixed key (see key schema in docs).
   * @param config    - Validated config for this call.
   * @param cost      - Number of tokens to consume. Must be ≥ 1.
   * @returns The decision.
   * @throws {StoreError} on I/O or connection failures (never on "denied").
   */
  consume<C, S>(
    algorithm: Algorithm<C, S>,
    key: string,
    config: C,
    cost: number,
  ): Promise<Decision>;

  /**
   * Non-consuming peek at the current state.
   *
   * @param algorithm - The algorithm whose `peek()` to run.
   * @param key       - The full, prefixed key.
   * @param config    - Validated config.
   * @returns The decision as if no tokens were consumed.
   * @throws {StoreError} on I/O failures.
   */
  peek<C, S>(algorithm: Algorithm<C, S>, key: string, config: C): Promise<Decision>;

  /**
   * Delete all state for a key, effectively resetting the limit.
   *
   * @param key - The full, prefixed key.
   * @throws {StoreError} on I/O failures.
   */
  reset(key: string): Promise<void>;

  /**
   * Gracefully release resources (timers, connections, sweep intervals).
   * Idempotent: calling `close()` twice is safe and has no effect.
   */
  close(): Promise<void>;

  /**
   * Optional. List keys matching a prefix pattern.
   *
   * Used by the admin API (Day 8). Not all stores need to implement this.
   * - **MemoryStore**: iterates the internal `Map`.
   * - **RedisStore**: uses `SCAN` with the pattern.
   *
   * @param prefix - Key prefix to match (e.g. `'reqnx:api:fixed-window:'`).
   * @returns An async iterable of matching keys.
   */
  keys?(prefix: string): AsyncIterable<string>;
}

// ─── Key Schema ───────────────────────────────────────────────────────────────

/**
 * Maximum byte length for a full Redis key.
 *
 * Keys exceeding this limit are SHA-256 hashed (hex) and prefixed with `h:`.
 * This prevents attacker-influenced identity strings from consuming excessive
 * Redis memory or exceeding Redis key-length limits.
 */
export declare const MAX_KEY_BYTES: 512;

// ─── Store Error Handling ─────────────────────────────────────────────────────

/**
 * Context passed to a custom {@link StoreErrorPolicy} handler.
 */
export interface StoreErrorContext {
  /** The identity key that was being checked. */
  readonly key: string;
  /** The cost that was being consumed. */
  readonly cost: number;
  /** The algorithm being executed. */
  readonly algorithmId: AlgorithmId;
}

/**
 * Policy applied when a {@link Store} operation throws a {@link StoreError}.
 *
 * - `'fail-open'` (default): Allow the request. The error is logged and
 *   reported via the `onError` hook.
 * - `'fail-closed'`: Deny the request with a synthetic Decision.
 * - Custom handler: receives the error and context, returns a Decision.
 *   A throwing custom handler is treated as `'fail-open'`.
 */
export type StoreErrorPolicy =
  | 'fail-open'
  | 'fail-closed'
  | ((error: StoreError, context: StoreErrorContext) => Decision);

// ─── Hooks / Observability ────────────────────────────────────────────────────

/**
 * Lifecycle hooks for observability. Hooks are called synchronously but
 * a **throwing hook must never affect the decision** or propagate to the
 * caller — errors are swallowed and logged.
 *
 * `prom-client` is never a core dependency. The Prometheus adapter (Day 9)
 * uses these hooks to increment counters and record histograms.
 */
export interface LimiterHooks {
  /**
   * Called after every `check()` or `peek()` with the outcome.
   * Errors thrown here are swallowed and reported to stderr.
   */
  onDecision?: (event: DecisionEvent) => void;

  /**
   * Called when a {@link StoreError} occurs, after the error policy is applied.
   */
  onError?: (event: ErrorEvent) => void;
}

/**
 * Event emitted by the `onDecision` hook.
 */
export interface DecisionEvent {
  /** The identity key that was checked. */
  readonly key: string;
  /** Which algorithm produced this decision. */
  readonly algorithmId: AlgorithmId;
  /** The decision that was returned to the caller. */
  readonly decision: Decision;
  /** The cost that was consumed (0 for peek). */
  readonly cost: number;
  /** Wall-clock duration of the store operation, in milliseconds. */
  readonly durationMs: number;
}

/**
 * Event emitted by the `onError` hook.
 */
export interface ErrorEvent {
  /** The identity key that was being checked. */
  readonly key: string;
  /** Which algorithm was being executed. */
  readonly algorithmId: AlgorithmId;
  /** The original store error. */
  readonly error: StoreError;
  /** The decision returned after applying the error policy. */
  readonly fallbackDecision: Decision;
}

// ─── Config Resolver ──────────────────────────────────────────────────────────

/**
 * Async config resolver for tiered/dynamic rate limits.
 *
 * Called per-request when a limiter is constructed with a `resolver` instead
 * of a static `config`. The limiter validates the resolver's output via
 * `algorithm.parseConfig()` on every call — the resolver should do its own
 * caching if lookups are expensive.
 *
 * @typeParam Config - The raw config shape (before parseConfig validation).
 *
 * @example
 * ```ts
 * const resolver: ConfigResolver<FixedWindowInput> = async (key) => {
 *   const tier = await getUserTier(key);
 *   return tier === 'pro'
 *     ? { max: 1000, window: '1m' }
 *     : { max: 100, window: '1m' };
 * };
 * ```
 */
export type ConfigResolver<Config> = (key: string) => Config | Promise<Config>;

// ─── Limiter (Public API) ─────────────────────────────────────────────────────

/**
 * Options for {@link createLimiter}.
 *
 * Exactly one of `config` or `resolver` must be provided.
 */
export interface LimiterOptions<Config, State> {
  /** The algorithm to use. */
  algorithm: Algorithm<Config, State>;

  /** The store to execute against. */
  store: Store;

  /**
   * Key namespace prefix. Must be non-empty ASCII, no colons.
   * Used in key schema: `reqnx:{prefix}:{algorithmId}:{identity}`.
   */
  prefix: string;

  /**
   * Static config. Validated once at construction via `algorithm.parseConfig()`.
   * Mutually exclusive with `resolver`.
   */
  config?: unknown;

  /**
   * Per-request async config resolver for tiered/dynamic limits.
   * Output is validated via `algorithm.parseConfig()` on every call.
   * Mutually exclusive with `config`.
   */
  resolver?: ConfigResolver<Config>;

  /**
   * Error handling policy for {@link StoreError}s.
   * @default 'fail-open'
   */
  onStoreError?: StoreErrorPolicy;

  /** Observability hooks. */
  hooks?: LimiterHooks;
}

/**
 * Options for a single `check()` call.
 */
export interface CheckOptions {
  /**
   * Number of tokens to consume. Must be ≥ 1.
   * @default 1
   */
  cost?: number;
}

/**
 * A configured, framework-agnostic rate limiter instance.
 *
 * All methods are safe to call concurrently. Denied requests are returned
 * as normal {@link Decision} values — never as exceptions.
 */
export interface Limiter {
  /**
   * Consume `cost` tokens for the given identity key.
   *
   * @param key  - Identity string (IP, user ID, API key, etc.).
   * @param opts - Optional per-call overrides.
   * @returns The rate-limit decision. Check `decision.allowed`.
   */
  check(key: string, opts?: CheckOptions): Promise<Decision>;

  /**
   * Non-consuming peek at the current state for a key.
   *
   * @param key - Identity string.
   * @returns The decision as if no tokens were consumed.
   */
  peek(key: string): Promise<Decision>;

  /**
   * Reset (delete) all state for a key, effectively removing the limit.
   *
   * @param key - Identity string.
   */
  reset(key: string): Promise<void>;
}

// ─── HTTP Headers ─────────────────────────────────────────────────────────────

/**
 * Which header families to emit from {@link decisionToHeaders}.
 */
export interface HeaderOptions {
  /**
   * Header style:
   * - `'draft'` — IETF draft-ietf-httpapi-ratelimit-headers-11:
   *   `RateLimit` and `RateLimit-Policy` headers.
   * - `'legacy'` — De-facto convention:
   *   `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
   * - `'both'` (default) — All of the above.
   *
   * See ADR-0005 for the full header strategy rationale.
   */
  style?: 'draft' | 'legacy' | 'both';
}

/**
 * HTTP headers derived from a {@link Decision}.
 *
 * All values are strings suitable for `res.setHeader()`.
 */
export interface RateLimitHeaders {
  /**
   * RFC 9110 §10.2.3: seconds until a retry would be sensible.
   * Only present when the request is denied (`allowed === false`).
   * Value is the ceiling of `retryAfterMs / 1000`.
   */
  'Retry-After'?: string;

  /**
   * IETF draft-ietf-httpapi-ratelimit-headers-11.
   * Structured field: `limit=100, remaining=42, reset=28`
   * where `reset` is seconds (integer) until the limit resets.
   */
  'RateLimit'?: string;

  /**
   * IETF draft-ietf-httpapi-ratelimit-headers-11.
   * Policy description, e.g. `100;w=60` (100 requests per 60s window).
   */
  'RateLimit-Policy'?: string;

  /** Legacy: maximum requests in the window. */
  'X-RateLimit-Limit'?: string;

  /** Legacy: remaining requests in the current window. */
  'X-RateLimit-Remaining'?: string;

  /** Legacy: epoch seconds when the window resets. */
  'X-RateLimit-Reset'?: string;
}

// Re-export error types (defined in errors.ts)
export type { ConfigError, StoreError } from './errors.js';
