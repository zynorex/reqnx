# Day 3 Benchmark Baseline: Fixed Window Counter

This document records baseline throughput and memory footprint metrics for the `@reqnx/core` fixed window counter algorithm and the in-memory store runtime.

> **Note on numbers:** All benchmark results are machine-specific and establish an internal baseline for Day 10 regression testing. They do not constitute marketing claims or external library comparisons.

---

## Environment Information

| Property    | Value                                           |
| ----------- | ----------------------------------------------- |
| **Date**    | 2026-10-04                                      |
| **Node.js** | v24.12.0                                        |
| **OS**      | Windows_NT 10.0.26200 (win32 x64)               |
| **CPU**     | 12th Gen Intel(R) Core(TM) i5-12500H (16 vCPUs) |
| **Memory**  | 16 GB RAM                                       |

---

## 1. Pure Algorithm Throughput (`vitest bench`)

Pure function invocations of `fixedWindow.step()` and `fixedWindow.peek()` without store or limiter overhead:

| Benchmark Case                            | Ops / sec        | Mean Latency | p99 Latency | Samples    |
| ----------------------------------------- | ---------------- | ------------ | ----------- | ---------- |
| `step() on fresh state`                   | 20,314,970 ops/s | ~0.0000 ms   | 0.0001 ms   | 10,157,485 |
| `step() on existing state (accumulating)` | 12,439,253 ops/s | 0.0001 ms    | 0.0002 ms   | 6,219,628  |
| `peek() on existing state`                | 12,685,925 ops/s | 0.0001 ms    | 0.0001 ms   | 6,342,964  |

---

## 2. In-Memory Limiter Throughput (`vitest bench`)

End-to-end `limiter.check()` pipeline (`createLimiter` + `createMemoryStore` + key validation + hook checks):

| Benchmark Case                            | Ops / sec     | Mean Latency | p99 Latency | Samples |
| ----------------------------------------- | ------------- | ------------ | ----------- | ------- |
| `limiter.check() with single hot key`     | 626,625 ops/s | 0.0016 ms    | 0.0046 ms   | 313,313 |
| `limiter.check() with 100k rotating keys` | 334,881 ops/s | 0.0030 ms    | 0.0112 ms   | 167,441 |

---

## 3. Memory Footprint (`scripts/bench-memory.ts`)

Measured using 100,000 distinct identity keys in `MemoryStore` with explicit V8 garbage collection (`--expose-gc`):

| Metric                        | Result                   |
| ----------------------------- | ------------------------ |
| **Total Keys Stored**         | 100,000                  |
| **Baseline Heap Used**        | 8.19 MB                  |
| **Final Heap Used (post-GC)** | 34.25 MB                 |
| **Heap Delta**                | 26.06 MB                 |
| **Memory per Key**            | **~273.3 bytes / key**   |
| **Insertion Duration**        | 190 ms (525,920 ops/sec) |

Raw JSON results are stored at [`docs/benchmarks/day-03.json`](file:///d:/zynorex%20Github/reqnx/docs/benchmarks/day-03.json).

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
