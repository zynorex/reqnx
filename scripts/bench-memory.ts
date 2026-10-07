/**
 * scripts/bench-memory.ts
 *
 * Measures memory footprint (bytes per key) for @reqnx/core MemoryStore with
 * the fixedWindow and tokenBucket algorithms at 100,000 distinct keys using V8 garbage collection.
 *
 * Run: node --expose-gc --import tsx scripts/bench-memory.ts
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fixedWindow, tokenBucket, createMemoryStore, createLimiter } from '../packages/core/src/index.js';

declare const gc: (() => void) | undefined;

async function measureAlgorithm(
  name: string,
  createLimiterInstance: (store: ReturnType<typeof createMemoryStore>) => ReturnType<typeof createLimiter>,
  keyCount: number,
) {
  if (typeof gc !== 'function') {
    throw new Error('GC must be exposed');
  }

  const store = createMemoryStore({ maxKeys: 150_000 });
  const limiter = createLimiterInstance(store);

  gc();
  gc();
  const baselineHeap = process.memoryUsage().heapUsed;

  const t0 = performance.now();

  for (let i = 0; i < keyCount; i++) {
    await limiter.check(`user-key-${i}`);
  }

  const durationMs = performance.now() - t0;

  gc();
  gc();
  // Keep store alive by reading its size
  const keyCountStored = store.size();
  const finalHeap = process.memoryUsage().heapUsed;
  const heapDeltaBytes = finalHeap - baselineHeap;
  const bytesPerKey = heapDeltaBytes / keyCount;

  return {
    algorithm: name,
    keyCount: keyCountStored,
    durationMs: Math.round(durationMs),
    opsPerSec: Math.round(keyCount / (durationMs / 1000)),
    baselineHeapBytes: baselineHeap,
    finalHeapBytes: finalHeap,
    heapDeltaBytes,
    bytesPerKey: Math.round(bytesPerKey * 10) / 10,
  };
}

async function main() {
  if (typeof gc !== 'function') {
    // eslint-disable-next-line no-console
    console.error('Error: GC must be exposed. Run with: node --expose-gc --import tsx scripts/bench-memory.ts');
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Starting memory footprint benchmark...');

  const KEY_COUNT = 100_000;

  // 1. Measure Fixed Window
  // eslint-disable-next-line no-console
  console.log(`\n[1/2] Benchmarking fixed-window with ${KEY_COUNT.toLocaleString()} keys...`);
  const fixedWindowResult = await measureAlgorithm(
    'fixed-window',
    (store) => {
      return createLimiter({
        algorithm: fixedWindow,
        store,
        prefix: 'bench-fw',
        config: { limit: 100, window: '1h' },
      });
    },
    KEY_COUNT,
  );
  // eslint-disable-next-line no-console
  console.log(`Fixed Window: ${fixedWindowResult.bytesPerKey.toFixed(1)} B/key, ${fixedWindowResult.opsPerSec.toLocaleString()} ops/sec`);

  // 2. Measure Token Bucket
  // eslint-disable-next-line no-console
  console.log(`\n[2/2] Benchmarking token-bucket with ${KEY_COUNT.toLocaleString()} keys...`);
  const tokenBucketResult = await measureAlgorithm(
    'token-bucket',
    (store) => {
      return createLimiter({
        algorithm: tokenBucket,
        store,
        prefix: 'bench-tb',
        config: { capacity: 100, refillTokens: 10, refillInterval: '1s' },
      });
    },
    KEY_COUNT,
  );
  // eslint-disable-next-line no-console
  console.log(`Token Bucket: ${tokenBucketResult.bytesPerKey.toFixed(1)} B/key, ${tokenBucketResult.opsPerSec.toLocaleString()} ops/sec`);

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
    benchmarks: {
      fixedWindow: fixedWindowResult,
      tokenBucket: tokenBucketResult,
      delta: {
        bytesPerKeyDelta: Math.round((tokenBucketResult.bytesPerKey - fixedWindowResult.bytesPerKey) * 10) / 10,
        opsPerSecRatio: Math.round((tokenBucketResult.opsPerSec / fixedWindowResult.opsPerSec) * 100) / 100,
      },
    },
  };

  // Ensure docs/benchmarks directory exists
  const docsBenchmarksDir = path.join(import.meta.dirname, '..', 'docs', 'benchmarks');
  if (!fs.existsSync(docsBenchmarksDir)) {
    fs.mkdirSync(docsBenchmarksDir, { recursive: true });
  }

  // Save raw JSON
  const jsonPath = path.join(docsBenchmarksDir, 'day-04.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`\nSaved JSON results to ${jsonPath}\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Benchmark failed:', err);
  process.exit(1);
});
