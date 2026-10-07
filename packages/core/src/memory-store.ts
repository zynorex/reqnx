// ──────────────────────────────────────────────────────────────────────────────
// @reqnx/core — MemoryStore
//
// In-process, single-threaded store with:
//   • Synchronous atomicity (no await between read and write)
//   • Lazy TTL expiry on read + bounded incremental sweeping
//   • LRU eviction when maxKeys is reached
//   • O(1) amortized for consume, peek, and reset
// ──────────────────────────────────────────────────────────────────────────────

import { type Algorithm, type Clock, type Decision, type Store } from './types.js';
import { StoreError } from './errors.js';
import { SystemClock } from './clock.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Options for {@link createMemoryStore}.
 */
export interface MemoryStoreOptions {
  /**
   * Clock to use for reading the current time.
   * Inject a {@link FakeClock} from `@reqnx/testkit` for deterministic tests.
   * @default SystemClock
   */
  clock?: Clock;

  /**
   * Maximum number of stored entries. When exceeded, expired entries are
   * purged first; if still full, the least-recently-used entry is evicted.
   *
   * **Cardinality-attack note:** evicting an active key resets that identity's
   * rate limit. Set this high enough for your expected cardinality and
   * monitor `stats().evictions`. For high-cardinality deployments, use RedisStore.
   *
   * @default 100_000
   */
  maxKeys?: number;

  /**
   * Trigger an incremental sweep of expired entries every N operations
   * (consume, peek, or reset calls). No background timer is used, keeping
   * the store portable to edge runtimes and deterministic under FakeClock.
   *
   * @default 1_000
   */
  sweepIntervalOps?: number;

  /**
   * Maximum number of entries to check during each incremental sweep.
   * Bounds the cost of sweeping so the hot path is never O(n).
   *
   * @default 500
   */
  sweepBatchSize?: number;
}

/**
 * Statistics from a MemoryStore instance.
 */
export interface MemoryStoreStats {
  /** Current number of stored entries. */
  readonly keys: number;
  /** Total number of LRU evictions (active keys removed to make room). */
  readonly evictions: number;
  /** Total number of sweep passes completed. */
  readonly sweeps: number;
}

/**
 * A MemoryStore instance, implementing {@link Store} plus diagnostics.
 */
export interface MemoryStore extends Store {
  /**
   * Manually sweep ALL expired entries. Returns the number purged.
   * This is O(n) and intended for maintenance, not the hot path.
   */
  sweep(): number;

  /** Current number of stored entries (including expired but not yet swept). */
  size(): number;

  /** Diagnostic statistics. */
  stats(): MemoryStoreStats;
}

// ─── Internal LRU list ────────────────────────────────────────────────────────

interface LruNode {
  key: string;
  prev: LruNode | null;
  next: LruNode | null;
}

function createLru() {
  const head: LruNode = { key: '<head>', prev: null, next: null };
  const tail: LruNode = { key: '<tail>', prev: null, next: null };
  head.next = tail;
  tail.prev = head;

  return {
    /** Insert a new node at the front (most-recently-used position). */
    addToFront(node: LruNode): void {
      node.prev = head;
      node.next = head.next;
      head.next!.prev = node;
      head.next = node;
    },

    /** Remove a node from its current position. */
    remove(node: LruNode): void {
      if (node.prev) node.prev.next = node.next;
      if (node.next) node.next.prev = node.prev;
      node.prev = null;
      node.next = null;
    },

    /** Move an existing node to the front (most-recently-used). */
    promote(node: LruNode): void {
      // Remove from current position
      if (node.prev) node.prev.next = node.next;
      if (node.next) node.next.prev = node.prev;
      // Insert at front
      node.prev = head;
      node.next = head.next;
      head.next!.prev = node;
      head.next = node;
    },

    /**
     * Remove and return the key of the least-recently-used node
     * (the one just before the tail sentinel).
     */
    evictLast(): string | undefined {
      if (tail.prev === head || tail.prev === null) return undefined;
      const node = tail.prev;
      if (node.prev) node.prev.next = tail;
      tail.prev = node.prev;
      node.prev = null;
      node.next = null;
      return node.key;
    },
  };
}

// ─── Internal entry ───────────────────────────────────────────────────────────

interface MemoryEntry {
  state: unknown;
  version: number;
  expiresAtMs: number;
  lruNode: LruNode;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create an in-memory rate-limit store.
 *
 * Atomic by construction: `algorithm.step()` is called synchronously with
 * no `await` between reading and writing state, guaranteeing no interleaving
 * on Node.js's single-threaded event loop.
 *
 * @param options - Store configuration.
 * @returns A {@link MemoryStore} instance.
 *
 * @example
 * ```ts
 * import { createMemoryStore } from '@reqnx/core';
 *
 * const store = createMemoryStore({ maxKeys: 50_000 });
 * // Use with createLimiter({ store, ... })
 * ```
 */
export function createMemoryStore(options?: MemoryStoreOptions): MemoryStore {
  const clock = options?.clock ?? SystemClock;
  const maxKeys = options?.maxKeys ?? 100_000;
  const sweepIntervalOps = options?.sweepIntervalOps ?? 1_000;
  const sweepBatchSize = options?.sweepBatchSize ?? 500;

  const entries = new Map<string, MemoryEntry>();
  const lru = createLru();
  let opCount = 0;
  let evictionCount = 0;
  let sweepCount = 0;
  let closed = false;

  // ── Helpers ──────────────────────────────────────────────────────────

  function assertOpen(): void {
    if (closed) {
      throw new StoreError('MemoryStore is closed');
    }
  }

  function removeEntry(key: string): boolean {
    const entry = entries.get(key);
    if (!entry) return false;
    lru.remove(entry.lruNode);
    entries.delete(key);
    return true;
  }

  /**
   * Bounded incremental sweep: check at most `sweepBatchSize` entries,
   * removing any that are expired. O(sweepBatchSize).
   */
  function incrementalSweep(nowMs: number): void {
    let checked = 0;
    for (const [key, entry] of entries) {
      if (checked >= sweepBatchSize) break;
      checked++;
      if (nowMs >= entry.expiresAtMs) {
        lru.remove(entry.lruNode);
        entries.delete(key);
      }
    }
    sweepCount++;
  }

  /** Count an operation and trigger incremental sweep if due. */
  function tickOp(nowMs: number): void {
    opCount++;
    if (opCount >= sweepIntervalOps) {
      opCount = 0;
      incrementalSweep(nowMs);
    }
  }

  /**
   * Ensure there's room for a new entry.
   * Only evicts if `keyToInsert` is not already in the store and we are at capacity.
   * Step 1: bounded sweep of expired entries.
   * Step 2: if still full, evict the LRU entry.
   * Total cost: O(sweepBatchSize) — never O(n).
   */
  function ensureCapacity(keyToInsert: string, nowMs: number): void {
    if (entries.has(keyToInsert)) return;
    if (entries.size < maxKeys) return;

    // Step 1: try purging expired entries (bounded)
    let checked = 0;
    for (const [key, entry] of entries) {
      if (entries.size < maxKeys) break;
      if (checked >= sweepBatchSize) break;
      checked++;
      if (nowMs >= entry.expiresAtMs) {
        lru.remove(entry.lruNode);
        entries.delete(key);
      }
    }

    // Step 2: still full → evict LRU
    if (entries.size >= maxKeys) {
      const evictedKey = lru.evictLast();
      if (evictedKey !== undefined) {
        entries.delete(evictedKey);
        evictionCount++;
      }
    }
  }

  /**
   * Read the current state for a key, handling expiry and version mismatch.
   * Does NOT modify entries (pure read). Returns undefined if absent,
   * expired, or version-mismatched.
   */
  function readState<S>(key: string, stateVersion: number, nowMs: number): S | undefined {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (nowMs >= entry.expiresAtMs) return undefined;
    if (entry.version !== stateVersion) return undefined;
    return entry.state as S;
  }

  // ── Store implementation ────────────────────────────────────────────

  const store: MemoryStore = {
    id: 'memory',

    async consume<C, S>(
      algorithm: Algorithm<C, S>,
      key: string,
      config: C,
      cost: number,
    ): Promise<Decision> {
      assertOpen();
      const nowMs = clock.nowMs();
      tickOp(nowMs);
      ensureCapacity(key, nowMs);

      // Read current state (expired/version-mismatched → undefined)
      const currentState = readState<S>(key, algorithm.stateVersion, nowMs);

      // Clean up expired/version-mismatched entry before writing new one
      const existingEntry = entries.get(key);
      const isReusing =
        existingEntry !== undefined &&
        nowMs < existingEntry.expiresAtMs &&
        existingEntry.version === algorithm.stateVersion;

      // Run the algorithm's step function synchronously — the core atomicity guarantee.
      // If step() throws, we catch it and wrap as StoreError with the original as cause.
      // The stored state is NOT modified on throw.
      let result: { readonly decision: Decision; readonly nextState: S };
      try {
        result = algorithm.step(currentState, config, nowMs, cost);
      } catch (err: unknown) {
        throw new StoreError(
          `Algorithm step() threw: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }

      // Persist the new state
      const ttlMs = algorithm.stateTtlMs(config);
      if (isReusing && existingEntry) {
        // Update in place, promote LRU.
        // Admitted requests refresh the TTL (idle eviction / full-refill horizon).
        existingEntry.state = result.nextState;
        existingEntry.version = algorithm.stateVersion;
        if (result.decision.allowed) {
          existingEntry.expiresAtMs = nowMs + ttlMs;
        }
        lru.promote(existingEntry.lruNode);
      } else {
        // Remove stale entry if present
        if (existingEntry) {
          lru.remove(existingEntry.lruNode);
          entries.delete(key);
        }

        // Create new entry
        const lruNode: LruNode = { key, prev: null, next: null };
        const newEntry: MemoryEntry = {
          state: result.nextState,
          version: algorithm.stateVersion,
          expiresAtMs: nowMs + ttlMs,
          lruNode,
        };
        entries.set(key, newEntry);
        lru.addToFront(lruNode);
      }

      return result.decision;
    },

    async peek<C, S>(algorithm: Algorithm<C, S>, key: string, config: C): Promise<Decision> {
      assertOpen();
      const nowMs = clock.nowMs();
      tickOp(nowMs);

      // peek has zero side effects on the peeked key:
      // - no state write
      // - no LRU promotion
      // - no expiry change
      // Expired entries are treated as absent but not removed.
      const currentState = readState<S>(key, algorithm.stateVersion, nowMs);

      return algorithm.peek(currentState, config, nowMs);
    },

    async reset(key: string): Promise<void> {
      assertOpen();
      const nowMs = clock.nowMs();
      tickOp(nowMs);
      removeEntry(key);
    },

    async close(): Promise<void> {
      closed = true;
      entries.clear();
    },

    /**
     * Full sweep: remove ALL expired entries. O(n).
     * Intended for manual maintenance, not the hot path.
     */
    sweep(): number {
      const nowMs = clock.nowMs();
      let purged = 0;
      for (const [key, entry] of entries) {
        if (nowMs >= entry.expiresAtMs) {
          lru.remove(entry.lruNode);
          entries.delete(key);
          purged++;
        }
      }
      sweepCount++;
      return purged;
    },

    size(): number {
      return entries.size;
    },

    stats(): MemoryStoreStats {
      return {
        keys: entries.size,
        evictions: evictionCount,
        sweeps: sweepCount,
      };
    },
  };

  return store;
}
