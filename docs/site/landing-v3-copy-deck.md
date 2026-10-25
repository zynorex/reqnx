# Landing v3: Authoritative Copy Deck & Evidence Mapping

**Branch:** `landing-v3`  
**Standard:** Developer-to-developer plain technical language. Zero marketing hype, zero exclamation marks, zero emojis, zero borrowed text. Every statement traces directly to `features.ts`, `claims.ts`, or the computed facts module.

---

## 1. Five H1 & Subhead Candidate Pairs

| Rank | Candidate | Headline (H1, Display XL, max 12 words) | Subhead (Lede, max 56ch) | Rationale & Evidence Mapping |
| :--- | :--- | :--- | :--- | :--- |
| **Top 1 (Recommended)** | `reason-about` | **Rate limiting you can reason about.** | Zero runtime dependencies. Pure step functions and atomic stores so your tests and callers always agree. | Direct promise to TypeScript backend developers. Grounded in Claim `claim:zero-runtime-deps` and `claim:pure-step-functions`. |
| **Top 2 (Runner-up)** | `know-why` | **Limit requests. Know exactly why.** | Every check returns an inspectable decision with remaining quota, reset time, and atomic guarantees. | Focuses on inspectability and decision contract. Mapped to ADR-0005 (`claim:decision-contract-fields`). |
| 3 | `shows-work` | **A rate limiter that shows its work.** | Decoupled algorithms, deterministic clocks, and test-backed contracts for TypeScript services. | Highlights mathematical rigor and testing architecture (ADR-0007). |
| 4 | `predictable` | **Predictable rate limiting for TypeScript services.** | Pure state transitions over memory or Redis with zero floating-point drift. | Highlights integer-arithmetic guarantees (ADR-0002). |
| 5 | `small-parts` | **Rate limiting built from small, checkable parts.** | One atomic step instead of read-modify-write races, verified by property and concurrency tests. | Emphasizes atomicity and composability. |

---

## 2. Section Headings, Ledes, Label Chips & Evidence

### S0. Header
- **Brand**: REQNX
- **Version Chip**: `v0.x pre-release` (`siteConfig.version`)
- **Nav items**: Docs, Algorithms, Playground, Status, GitHub
- **Action**: Get started (Pill button)

### S1. Hero Stage
- **Label Chip**: `PRE-RELEASE · WHAT WORKS TODAY` (Links to `#status`)
- **H1**: *Rate limiting you can reason about.*
- **Subhead**: *Zero runtime dependencies. Pure step functions and atomic stores so your tests and callers always agree.*
- **CTAs**: Primary: `Get started` (href: `/getting-started/`) \| Secondary: `Open the playground` (href: `/playground/`)
- **Install / Command Chip**: `npm i @reqnx/core` (with copy button; or clone command if unpublished)
- **Console Caption**: `Simulated time. This is the real library running in your browser.`

### S2. Platform Section: "How it fits together"
- **Label Chip (UI Control)**: Segmented control: `Store: Memory | Redis (Planned)`
- **H2**: **One engine. Decoupled algorithms, clocks, and stores.**
- **Lede**: *Your application code never touches rate limiting logic directly. A single check command executes a pure state transition against your chosen store.*
- **Spec Grid**:
  - Stat 1: `0` runtime dependencies in core (computed fact `facts.runtimeDependencies`)
  - Stat 2: `2 / 5` algorithms implemented today (computed fact `facts.availableAlgorithmsCount`)
  - Stat 3: `19` documented architectural decision records (computed fact `facts.adrCount`)
  - Pillar 1: `01 · Pure Transitions` — Step functions take state and time, returning new state and quota without side effects.
  - Pillar 2: `02 · Injected Clocks` — Time is a parameter, making multi-year drift tests complete in milliseconds.
  - Pillar 3: `03 · Atomic Persistence` — Store operations execute in single atomic transactions to eliminate window-edge races.

### S3. Proof Band
- **Label Chip**: `VERIFIED EVIDENCE`
- **H2**: **Every claim links to the test or source file behind it.**
- **Lede**: *No customer logos or marketing endorsements. Our proof is test suites, formal properties, and recorded benchmarks.*
- **Marquee Chips**:
  - `✓ 0 runtime dependencies` → `packages/core/package.json`
  - `✓ Fast-check model tests` → `token-bucket.model.test.ts`
  - `✓ Integer ms arithmetic` → `duration.ts`
  - `✓ Atomic memory store` → `memory-store.ts`
  - `✓ ADR-0002 Atomicity` → `/design/adr/0002/`
  - `✓ Zero floating drift` → `token-bucket.test.ts`
  - `✓ Standard headers` → `limiter.ts`
  - `✓ Deterministic replay` → `scenario.test.ts`
- **Featured Quote**: Verbatim from ADR-0002:
  > *"Every algorithm execution must transition state atomically with respect to concurrent checks on the same key."*  
  — **ADR 0002: Algorithm Contract & Atomicity (Accepted)**

### S4. Contrast Section
- **Label Chip**: `ENGINEERING CONTRAST`
- **H2 (Two-Tone)**: **What a read-modify-write limiter gets wrong.**  
  *(And what one atomic step does instead.)*
- **Lede**: *Most hand-rolled limiters fetch quota from a database, compute a decision in application memory, and write the result back. Under concurrency, this allows double-spend bursts.*
- **Left Panel (RMW Pitfalls)**:
  - Label: `READ, COMPUTE, WRITE (UNSAFE)`
  - Callout 1: *The read and the write are decoupled transactions.*
  - Callout 2: *Clock values come from unsynchronized server nodes.*
  - Callout 3: *Window boundaries permit 2x traffic bursts.*
  - Callout 4: *Network timeouts leave quota in corrupt limbo.*
- **Right Panel (Atomic Single Step)**:
  - Label: `ATOMIC CONTRACT (REQNX)`
  - Callout 1: *State transition evaluates entirely inside the store boundary.*
  - Callout 2: *Monotonic integer timestamp injected by coordinated source.*
  - Callout 3: *Continuously replenished token buckets eliminate boundary cliffs.*
  - Callout 4: *Explicit failure policies define degrade behavior.*
- **The Race Control**:
  - Heading: *Live Race Simulation*
  - Button: `Send 1,000 at once`
  - Result readout: Non-atomic: *1,000 admitted of 100 limit* vs REQNX Atomic: *100 admitted of 100 limit*.

### S5. Choose Your Guarantee (Tiers Section)
- **Label Chip**: `ALGORITHM GUARANTEES`
- **H2 (Two-Tone)**: **Choose the guarantee you need.**  
  *(Not the one that fits in memory.)*
- **Lede**: *Select the rate limiting algorithm tailored to your traffic profile and resource constraints.*
- **Pill Tabs**: `Token Bucket` \| `Fixed Window` \| `Sliding Window (Planned)` \| `Leaky Bucket (Planned)`
- **Algorithm Cards**:
  - Card 1: **Token Bucket** — `Exact Burst Handling` · Smooth replenishment · Memory: 2 integers · Status: Available
  - Card 2: **Fixed Window** — `Lowest Memory Footprint` · Counter reset · Memory: 1 counter · Status: Available
  - Card 3: **Sliding Log** — `Zero Boundary Edge Burst` · Exact sliding · Status: Planned

### S6. Benefits Grid & Sequenced Terminal
- **Label Chip**: `ARCHITECTURE`
- **H2**: **Engineered for production resilience.**
- **Lede**: *Designed from day one for mission-critical TypeScript infrastructure.*
- **Benefit Rows**:
  1. *Fits your existing stack*: First-class adapters for Express, Fastify, and standalone TypeScript.
  2. *Single unified contract*: Swap between Memory and Redis stores without altering business logic.
  3. *Explicit failure modes*: Fail-open, fail-closed, or route to custom degradation policies.
  4. *Testable by design*: Virtual clocks allow testing 30-day rate windows in sub-millisecond unit tests.
  5. *Zero lock-in*: MIT licensed, completely transparent code with zero telemetry.
- **Terminal Panel**:
  - Title: `pnpm --filter @reqnx/core test`
  - Sequenced test output ending with `36 passed (36)`.

### S7. Status Matrix: What Works Today
- **Label Chip**: `HONEST STATUS`
- **H2**: **Current implementation progress.**
- **Lede**: *We track all features in a strict public status registry. Nothing is marked available until test suites pass.*
- **Status Columns**: Available Today vs In Active Development.

### S8. Technical FAQ
- **Label Chip**: `FREQUENTLY ASKED`
- **H2**: **Technical questions and trade-offs.**
- **Questions**:
  - *Why not use redis-rate-limiter directly?*
  - *How does REQNX prevent floating-point drift?*
  - *Can I run this without Redis?*
  - *How does fail-open behave during store disconnection?*

### S9. Closing Band
- **H2**: **Predictable rate limiting. Run it from source today.**
- **Lede**: *No account. No credit card. Zero telemetry. MIT licensed.*
- **Actions**: `Get started` (Pill button) \| `Browse GitHub source` (quiet link).
