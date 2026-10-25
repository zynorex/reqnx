# Gate 2 Review: Landing v3 Hero & Platform Architecture Stage

**Branch:** `landing-v3`  
**Commit:** `a046839`  
**Status:** Ready for Gate 2 User Approval  

---

## 1. Visual Verification & Contact Sheet

We have built and verified **S1 (Hero)** and **S2 (Platform Architecture Section)** across desktop (1440px) and mobile (390px) viewports in both Dark Mode and Warm Cream Light Mode (`#fffbf5`).

````carousel
![Hero and Platform Overview (1440px Dark Mode)](/stage3-hero-arch-1440-dark.png)
<!-- slide -->
![Hero and Platform Overview (1440px Warm Cream Light Mode)](/stage3-hero-arch-1440-light.png)
<!-- slide -->
![Architecture Stage & SpecGrid Close-up (1440px Dark)](/stage3-arch-1440-dark.png)
<!-- slide -->
![Architecture Stage & SpecGrid Close-up (1440px Light)](/stage3-arch-1440-light.png)
<!-- slide -->
![Mobile Layout (390px Dark Mode)](/stage3-hero-arch-390-dark.png)
<!-- slide -->
![Mobile Layout (390px Warm Cream Light Mode)](/stage3-hero-arch-390-light.png)
````

---

## 2. What Was Implemented

### S1. Flagship Hero Stage (`HeroV3.astro`)
- **Approved Art Direction**: Option C (Quiet Canvas) with Warm Cream (`#fffbf5`) light mode canvas, dark charcoal (`#0b0d13`) in dark mode, and subtle 6–8% precision tick grid motif with pointer tracking backlight (`E6`).
- **Eyebrow StatusPill**: Links to `#status` (`PRE-RELEASE | v0.x · What works today →`).
- **Editorial H1**: `"Rate limiting you can reason about."` in Inter 500 display, static SSR HTML with zero animation delay (strict LCP element).
- **Subhead**: `"Zero runtime dependencies. Pure step functions and atomic stores so your tests and callers always agree."` (max 56ch).
- **CTA Row**:
  - Primary pill button: `Get started` (`shape="pill"`, `size="lg"`, href `/getting-started/`).
  - Quiet link: `Open the playground →` (href `/playground/`).
  - Terminal Command Chip: `$ git clone https://github.com/zynorex/reqnx.git` with accessible copy button.
- **Product Stage Overhang**:
  - Real browser `LiveConsole` pre-rendered with zero CLS, straddling the hero bottom edge by **64px** into the platform section below.
  - Mascot companion perched on top-right edge with denial nod animation (`E22`).

### S2. Platform Architecture Section (`ArchitectureStage.astro`)
- **Accommodating Overhang**: Section top padding accommodates the 64px hero console overhang seamlessly.
- **Section Heading**:
  - Label: `ARCHITECTURE`
  - H2: `"One engine. Decoupled algorithms, clocks, and stores."`
  - Lede: `"Your application code never touches rate limiting logic directly. A single check command executes a pure state transition against your chosen store."`
- **Store Segmented Control**: UI-native pill tab switcher: `Store: Memory (Live) | Redis (Planned)`.
- **Interactive SVG Architecture Stage**:
  - Highlights the 3 decoupled pillars:
    1. `01 · INGRESS`: Incoming HTTP request (`POST /api/chat`, key `ip:198.51.100.1`, cost `1 token`).
    2. `02 · REQNX CORE`: Pure State Transition (`(state, now) -> (nextState, decision)`), Injected Monotonic Clock (`clock.now()`), and Atomic Store (`MemoryStore` lock-free JS Map vs `RedisStore` atomic Lua script).
    3. `03 · DECISION`: Allowed (200 OK) / Denied (429 Too Many Requests) with recoil animation (`E9`/`E20`), latency readout (`0.04 ms`), and live assistive announcements.
  - Interactive **"Send request packet"** button that sends packets along the path in real time.
- **SpecGrid with Live Repository Facts**:
  - Top row: 3 big numerals joined by 1px hairlines:
    - **`0`**: Runtime dependencies in core library (`packages/core/package.json`)
    - **`2 / 5`**: Algorithms verified and available today (`features.ts` registry)
    - **`19`**: Architectural decision records committed (`docs/adr/*.md`)
  - Bottom row: 3 architectural pillars:
    - `01 · PURE TRANSITIONS`: Pure Step Functions
    - `02 · MONOTONIC TIME`: Injected Clocks
    - `03 · ATOMIC PERSISTENCE`: Atomic Store Contract

---

## 3. Verification & Metrics

- **Unit Tests**: 37 test files passed, 318 tests passed (0 failures).
- **TypeScript**: 0 errors (`pnpm typecheck`).
- **Lint**: 0 errors (`pnpm lint`).
- **Button Linter**: Passed (`lint-css-buttons`, `lint-source-buttons`, `lint-button-labels`).
- **Production Build**: Complete in 8.13s, 30 pages generated, 0 dev styleguide pages emitted.
