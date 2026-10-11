# Day 4 Benchmark Baseline: Token Bucket Algorithm

This document records baseline throughput and memory footprint metrics for the `@reqnx/core` token bucket rate-limiting algorithm and its integration with `MemoryStore` and `createLimiter`.

> **Note on numbers:** All benchmark results are machine-specific and establish an internal baseline for regression testing across development phases. They do not constitute marketing claims or external library comparisons.

---

## Environment Information

| Property    | Value                                           |
| ----------- | ----------------------------------------------- |
| **Date**    | 2026-10-07                                      |
| **Node.js** | v24.12.0                                        |
| **OS**      | Windows_NT 10.0.26300 (win32 x64)               |
| **CPU**     | 12th Gen Intel(R) Core(TM) i5-12500H (16 vCPUs) |
| **Memory**  | 16 GB RAM                                       |

---

## 1. Pure Algorithm Throughput (`vitest bench`)

Pure function invocations of `tokenBucket.step()`, `tokenBucket.peek()`, and `tokenBucket.parseConfig()` without store or limiter overhead:

| Benchmark Case                                        | Ops / sec        | Mean Latency | p99 Latency | Samples    |
| ----------------------------------------------------- | ---------------- | ------------ | ----------- | ---------- |
| `parseConfig per call (resolver path)`                | 6,426,276 ops/s  | 0.0002 ms    | 0.0003 ms   | 3,213,139  |
| `step() on fresh state`                               | 20,194,217 ops/s | ~0.0000 ms   | 0.0001 ms   | 10,097,111 |
| `step() on existing state (accumulating & refilling)` | 17,454,912 ops/s | 0.0001 ms    | 0.0001 ms   | 8,727,456  |
| `peek() on existing state`                            | 18,721,632 ops/s | 0.0001 ms    | 0.0001 ms   | 9,360,816  |

---

## 2. In-Memory Limiter Throughput (`vitest bench`)

End-to-end `limiter.check()` pipeline (`createLimiter` + `createMemoryStore` + key validation + hook checks):

| Benchmark Case                            | Ops / sec     | Mean Latency | p99 Latency | Samples |
| ----------------------------------------- | ------------- | ------------ | ----------- | ------- |
| `limiter.check() with single hot key`     | 842,599 ops/s | 0.0012 ms    | 0.0022 ms   | 421,300 |
| `limiter.check() with 100k rotating keys` | 632,283 ops/s | 0.0016 ms    | 0.0028 ms   | 316,142 |

---

## 3. Memory Footprint (`scripts/bench-memory.ts`)

Measured using 100,000 distinct identity keys in `MemoryStore` with explicit V8 garbage collection (`--expose-gc`):

| Metric                        | Fixed Window          | Token Bucket          | Delta                         |
| ----------------------------- | --------------------- | --------------------- | ----------------------------- |
| **Total Keys Stored**         | 100,000               | 100,000               | 0                             |
| **Baseline Heap Used**        | 8.17 MB               | 8.33 MB               | +0.16 MB                      |
| **Final Heap Used (post-GC)** | 36.27 MB              | 37.91 MB              | +1.64 MB                      |
| **Heap Delta**                | 28.10 MB              | 29.58 MB              | +1.48 MB                      |
| **Memory per Key**            | **281.0 bytes / key** | **295.8 bytes / key** | **+14.8 bytes / key (+5.3%)** |
| **Insertion Ops / sec**       | 521,495 ops/s         | 552,804 ops/s         | +31,309 ops/s (+6.0%)         |

Raw JSON results are stored at [`docs/benchmarks/day-04.json`](file:///d:/zynorex%20Github/reqnx/docs/benchmarks/day-04.json).

---

## 4. Token Bucket vs Fixed Window Delta Comparison

Comparison across pure algorithm and limiter throughput from the same session:

| Benchmark Dimension            | Fixed Window     | Token Bucket     | Delta / Ratio | Analysis                                                                                          |
| ------------------------------ | ---------------- | ---------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| **`step()` fresh state**       | 21,067,229 ops/s | 20,194,217 ops/s | -4.1%         | Identical order of magnitude; minimal overhead for GCD-normalised state                           |
| **`step()` existing state**    | 16,614,040 ops/s | 17,454,912 ops/s | +5.1%         | Clamped integer arithmetic performs comparably to window modulo                                   |
| **`peek()` existing state**    | 11,309,569 ops/s | 18,721,632 ops/s | +65.5%        | Token bucket peek is a single clamp-and-floor calculation                                         |
| **Limiter hot key**            | 385,310 ops/s    | 842,599 ops/s    | +118.7%       | Consistent V8 JIT in-memory store path                                                            |
| **Limiter 100k rotating keys** | 319,291 ops/s    | 632,283 ops/s    | +98.0%        | Excellent cache locality and amortised O(1) LRU promotion                                         |
| **Heap memory per key**        | 281.0 B/key      | 295.8 B/key      | +14.8 B/key   | Expected: 4 numerical state fields (`level`, `at`, `a`, `b`) vs 2 fields (`windowStart`, `count`) |

---

## How to Run

```bash
# Run Vitest throughput benchmarks
pnpm bench:vitest

# Run V8 memory footprint benchmark
pnpm bench:memory

# Run both
pnpm bench
```
