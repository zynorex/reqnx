# REQNX Landing Page v2 & 404 — Plain-Text Copy Review

**Status**: Verified & Compliant with Claims Ledger  
**Tone**: Technical, factual, developer-to-developer, zero marketing buzzwords, zero exclamation marks, zero emojis.  
**Source Deck**: [`apps/site/src/copy/landing.copy.ts`](file:///d:/zynorex%20Github/reqnx/apps/site/src/copy/landing.copy.ts)  
**Claims Ledger**: [`docs/site/claims.md`](file:///d:/zynorex%20Github/reqnx/docs/site/claims.md)

---

## 1. Header & Navigation

| Element            | Text                                             | Evidence / Binding                        |
| :----------------- | :----------------------------------------------- | :---------------------------------------- |
| **Brand Logo Alt** | REQNX home                                       | Accessibility standard                    |
| **Version Chip**   | `0.x Pre-release`                                | `packages/core/package.json` (`0.0.0`)    |
| **Nav Links**      | Docs · Algorithms · Playground · Status · GitHub | Valid site routes and repo link           |
| **Theme Toggle**   | System · Light · Dark                            | 3-state localStorage + media query toggle |
| **Primary CTA**    | Get started                                      | Links to `/getting-started/`              |

---

## 2. Hero Section

- **Eyebrow Chip**: `Open source · MIT · v0.x`  
  _(Facts: MIT license on disk; v0.x pre-release)_
- **Primary Headline**: `Rate limiting built from small, checkable parts.`
- **Subhead**: `Zero runtime dependencies. Pure state-transition functions. Injected clocks and atomic stores so your tests and callers always agree.`  
  _(Claims: `zero-dependencies`, `pure-algorithms`, `injected-clock`, `concurrency-atomic`)_
- **Primary Action**: `Get started` -> `/getting-started/`
- **Secondary Action**: `Try the playground` -> `/playground/`
- **Command Box**:
  - Unpublished state: `RUN FROM SOURCE` `git clone https://github.com/zynorex/reqnx.git`
  - Published state: `INSTALL` `npm install @reqnx/core`
- **Live Instrument Caption**: `Simulated time. This is the real @reqnx/core library running in your browser.`  
  _(Evidence: Browser executes real `@reqnx/core` bundle via Preact and Web Worker / fake clock)_
- **Mascot Placement**: Supportive co-pilot positioned outside data boundaries, peering over the instrument stage. Hidden on `<900px` viewports.

---

## 3. Proof Strip

Verifiable build-time facts computed dynamically by `facts.ts`:

1. **0 Dependencies** — `@reqnx/core` runtime dependencies. Source: `packages/core/package.json`.
2. **ESM + CJS + Types** — Dual module format exports with bundled `.d.ts`. Source: `packages/core/package.json`.
3. **Core Bundle (gzip)** — ~2.4 kB minified ESM bundle. Source: `packages/core/dist/index.js`.
4. **14 Architectural Decisions** — Formal accepted ADRs documenting trade-offs. Source: `docs/adr/`.
5. **2 of 5 Algorithms Available** — Fixed Window and Token Bucket shipped and tested. Source: `apps/site/src/features.ts`.
6. **500k+ ops/sec Throughput** — Downward-rounded single-thread in-memory throughput. Source: `packages/core/benchmark.json`.

---

## 4. What It Is

- **Eyebrow**: `What it is`
- **Title**: `A rate limiter built from small, checkable parts.`
- **Lede**: `It decides, for each request, whether a caller is within their quota. You select an algorithm and a store; it returns a decision your application and your callers can act on.`
- **The Decision Contract Fields**:
  - `allowed` (`boolean`): True if the request is admitted within quota; false if rejected.
  - `remaining` (`number`): Remaining request units permitted within the current span.
  - `resetAtMs` (`number`): Epoch millisecond timestamp when the current window resets or refills.
  - `retryAfterMs` (`number`): Milliseconds the client must wait before retrying when rejected.
  - `limit` (`number`): The maximum capacity configured for this key and span.
- **Why Exact Rate Limiting Is Hard**:
  - **Time and drift**: System clocks jump backward during NTP syncs, and servers in a cluster do not agree on the current millisecond. _Solution: Algorithms never read the system clock directly. Time is injected as an explicit integer, and window resets anchor to epoch intervals._
  - **Race conditions**: Two simultaneous requests can both observe one token remaining and both deduct it, allowing traffic past the quota. _Solution: Check, algorithm step, and state persistence execute as a single atomic operation in MemoryStore and in Redis Lua scripts._
  - **Store unavailability**: When Redis disconnects or a store crashes, uncaught errors crash process handlers or block legitimate traffic. _Solution: Configurable failure policies (fail-open, fail-closed, custom fallback) isolate store errors and tag degraded decisions clearly._
- **Who It's For**:
  - Backend engineers building Node.js and TypeScript APIs that need deterministic rate limiting.
  - Teams requiring verifiable concurrency guarantees across both single-process and distributed Redis tiers.
  - Developers who write automated tests and cannot tolerate sleeping in test suites.

---

## 5. Why Choose It

- **Eyebrow**: `Why choose it`
- **Title**: `Reasons you can check`
- **Lede**: `Every guarantee links directly to an automated test, an architectural decision record, or a pure function in the repository.`
- **Where It Fits**: `Coarse network attacks belong at the edge or CDN. Business rate limiting belongs inside your application layer alongside your domain logic.`
- **Not The Right Tool If**:
  - You need protection against massive volumetric DDoS attacks (enforce those at your CDN or edge WAF).
  - You require proxy-level rate limiting in NGINX or Envoy without writing application code.
  - Your backend stack is written in Go, Rust, or Python (Reqnx is TypeScript/Node.js).
  - You want a hosted third-party SaaS dashboard with managed billing and credit-card quotas.
  - You need requests queued and throttled for deferred processing rather than immediately admitted or rejected.

---

## 6. The Seam (Boundary Burst Mechanics)

- **Eyebrow**: `Algorithm mechanics`
- **Title**: `Fixed windows have a seam`
- **Lede**: `Rigid window boundaries allow traffic concentrated at the boundary to consume twice the limit in a fraction of a second.`
- **Figure Caption**: `With limit 5 per 10s: 5 requests land right before the 10.0s boundary, and 5 more land right after. Ten requests are admitted in 80 milliseconds.`
- **Mitigation**: `This behavior is mathematically intrinsic to fixed windows. To eliminate boundary bursts, switch to continuous Token Bucket or Sliding Window Counter.`

---

## 7. Algorithms

- **Eyebrow**: `Algorithms`
- **Title**: `Five classical strategies`
- **Lede**: `Select the right trade-off between throughput, memory footprint, and burst tolerance. Adding an algorithm requires zero modifications to existing components.`
- **Selection Guide**:
  - Use Fixed Window Counter for raw throughput when brief 2x boundary spikes are harmless.
  - Use Token Bucket when callers send legitimate bursty traffic that should refill smoothly.
  - Use Sliding Window Counter for strict rolling quotas with minimal memory overhead.
  - Use Sliding Window Log when exact rolling timestamp auditing is mandatory.
  - Use Leaky Bucket when downstream dependencies require smooth, constant-rate request processing.

---

## 8. Quickstart

- **Eyebrow**: `Quickstart`
- **Title**: `From zero to an enforced rate limit`
- **Lede**: `Create a store, configure an algorithm, and check callers. The output on the right is generated by running this exact snippet in Node.js.`
- **Steps**:
  1. Install `@reqnx/core` using your preferred package manager.
  2. Instantiate MemoryStore and select an algorithm.
  3. Evaluate request keys and pass or reject callers based on the returned Decision.
- **Verified Output**: Produced by running `apps/site/src/snippets/quickstart.ts` during build.

---

## 9. Recipes

- **Eyebrow**: `Recipes`
- **Title**: `Common limits, ready to adapt`
- **Lede**: `Tested configurations for common API patterns, with real decisions produced by the library runtime.`
- **Key Choice Note**: `Always rate limit on authenticated user IDs or API keys where possible. Do not trust forwarded IP headers (X-Forwarded-For) without verifying that your reverse proxy strips spoofed client headers.`

---

## 10. Architecture

- **Eyebrow**: `Architecture`
- **Title**: `Data flow and separation of concerns`
- **Lede**: `The limiter validates parameters and handles failure; the store guarantees atomic execution; the algorithm is a pure state machine without I/O or clock dependencies.`

---

## 11. Implementation Status

- **Eyebrow**: `Implementation progress`
- **Title**: `What works today`
- **Lede**: `Every item links to the code or test behind it. Features are marked available only when passing tests exist on disk.`
- **Not Yet Verified**:
  - Multi-node Redis Cluster and Valkey failover behaviors are designed but not yet integration tested.
  - Distributed Lua scripts under sustained multi-instance network latency are scheduled for Day 6.
  - Express and Fastify framework middleware packages are in stub status until Day 7.

---

## 12. Frequently Asked Questions

Includes 14 deep technical answers categorised into:

1. **Getting Started**: Redis necessity, algorithm selection, key choosing, framework adapters.
2. **Design & Mechanics**: Clock drift & NTP jumps, concurrency safety, store failure isolation, Redis Cluster hash slots, edge runtimes.
3. **Production & Operations**: Production status (v0.x pre-release), throughput benchmarks, deterministic testing with FakeClock, telemetry & hooks.
4. **Project & Governance**: Custom algorithm implementation, brand asset licensing policy, open source contribution guidelines.

---

## 13. Open Source & Decision Log

- **Eyebrow**: `Open source`
- **Title**: `Open source, MIT, built in the open`
- **Lede**: `Code is developed with public commits, transparent architectural records, and comprehensive automated test suites.`
- **ADR Count**: 14 Architecture Decision Records linked to repository files.

---

## 14. Final Call to Action

- **Title**: `Try it before you install it`
- **Lede**: `Run the interactive playground in your browser, explore the algorithm specifications, or inspect the source code on GitHub.`
- **Actions**: `Read the quickstart` · `Open the playground` · `View repository on GitHub`

---

## 15. Footer

- **Brand License**: `Software licensed under MIT. Reqnx logo, mascot, and character illustrations are copyright the project maintainers.`
- **Trademark Notice**: `Redis is a registered trademark of Redis Ltd. Express and Fastify are trademarks of their respective owners. REQNX has no official affiliation with these projects.`
- **Privacy Notice**: `No cookies. No tracking.`

---

## 16. Error 404 Page (`/404`)

- **Eyebrow**: `ERROR 404`
- **Headline**: `This route has been dropped.`
- **Subhead**: `The requested page does not exist or has been moved to another location.`
- **Path Display**: Shows dynamic `Requested: <pathname>` with fuzzy route suggestions.
- **Actions**: `Back to home ->` · `Documentation` · `Algorithms` · `Playground` · `Report a broken link`
- **Illustration**: 404 mascot illustration with dropped coins and translucent 404 background numerals.
