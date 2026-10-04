/**
 * scripts/bench-memory.ts
 *
 * Measures memory footprint (bytes per key) for @reqnx/core MemoryStore with
 * the fixedWindow algorithm at 100,000 distinct keys using V8 garbage collection.
 *
 * Run: node --expose-gc --import tsx scripts/bench-memory.ts
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fixedWindow, createMemoryStore, createLimiter } from '../packages/core/src/index.js';

declare const gc: (() => void) | undefined;

async function main() {
  if (typeof gc !== 'function') {
    // eslint-disable-next-line no-console
    console.error('Error: GC must be exposed. Run with: node --expose-gc --import tsx scripts/bench-memory.ts');
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Starting memory footprint benchmark...');

  // Force GC to establish clean baseline
  gc();
  gc();
  const baselineHeap = process.memoryUsage().heapUsed;

  const KEY_COUNT = 100_000;
  const store = createMemoryStore({ maxKeys: 150_000 });
  const limiter = createLimiter({
    algorithm: fixedWindow,
    store,
    prefix: 'bench',
    config: { limit: 100, window: '1h' },
  });

  // eslint-disable-next-line no-console
  console.log(`Inserting ${KEY_COUNT.toLocaleString()} keys...`);
  const t0 = performance.now();

  for (let i = 0; i < KEY_COUNT; i++) {
    await limiter.check(`user-key-${i}`);
  }

  const durationMs = performance.now() - t0;

  // Force GC again to collect temporary allocations
  gc();
  gc();

  const finalHeap = process.memoryUsage().heapUsed;
  const heapDeltaBytes = finalHeap - baselineHeap;
  const bytesPerKey = heapDeltaBytes / KEY_COUNT;
  const storeStats = store.stats();

  const envInfo = {
    date: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCores: os.cpus().length,
    totalRamMb: Math.round(os.totalmem() / (1024 * 1024)),
  };

  const results = {
    environment: envInfo,
    benchmark: {
      algorithm: 'fixed-window',
      store: 'MemoryStore',
      keyCount: KEY_COUNT,
      storeKeys: storeStats.keys,
      durationMs: Math.round(durationMs),
      opsPerSec: Math.round((KEY_COUNT / (durationMs / 1000))),
      baselineHeapBytes: baselineHeap,
      finalHeapBytes: finalHeap,
      heapDeltaBytes,
      bytesPerKey: Math.round(bytesPerKey * 10) / 10,
    },
  };

  // eslint-disable-next-line no-console
  console.log('\n--- Benchmark Results ---');
  // eslint-disable-next-line no-console
  console.log(`Keys stored: ${storeStats.keys.toLocaleString()}`);
  // eslint-disable-next-line no-console
  console.log(`Duration: ${Math.round(durationMs)} ms (${Math.round(KEY_COUNT / (durationMs / 1000)).toLocaleString()} ops/sec)`);
  // eslint-disable-next-line no-console
  console.log(`Heap Delta: ${(heapDeltaBytes / (1024 * 1024)).toFixed(2)} MB`);
  // eslint-disable-next-line no-console
  console.log(`Bytes Per Key: ${bytesPerKey.toFixed(1)} B/key\n`);

  // Ensure docs/benchmarks directory exists
  const docsBenchmarksDir = path.join(import.meta.dirname, '..', 'docs', 'benchmarks');
  if (!fs.existsSync(docsBenchmarksDir)) {
    fs.mkdirSync(docsBenchmarksDir, { recursive: true });
  }

  // Save raw JSON
  const jsonPath = path.join(docsBenchmarksDir, 'day-03.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`Saved JSON results to ${jsonPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Benchmark failed:', err);
  process.exit(1);
});
