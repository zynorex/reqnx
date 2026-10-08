# Landing Page v2 Plan (Approved Gate 1 Spec)

## 1. Asset Audit & Brand Inputs
All originals are located in `brand/` at the repository root and treated as read-only.

| Asset | Format & Size | Alpha | Byte Size | Role & Display Policy |
| :--- | :--- | :--- | :--- | :--- |
| `logo.png` | 1254 × 1254 px, 8-bit RGB | None (opaque `#111319`) | 942,677 B | Logo mark. Front-facing cyan bucket with sunglasses and coin. Contains no lettering. Paired with HTML/SVG wordmark. Styled with dark squircle badge on light backgrounds to prevent harsh rectangular borders. |
| `mascot.png` | 1254 × 1254 px, 8-bit RGBA | True Alpha | 573,527 B | Guide character. Full body bucket waving and holding token. Clean neutral anti-aliasing edges without halos. Placed at Hero, Open Source, and Final CTA. |
| `404.png` | 1536 × 1024 px, 8-bit RGBA | True Alpha | 1,372,809 B | Main 404 page art. Distressed mascot with spilled bouncing coins and translucent white "404" background numerals. |
| `favicon.png` | 1254 × 1254 px, 8-bit RGB | None (white margin outside dark squircle) | 986,013 B | Favicon master source. Downsampled to generate apple-touch-icon.png (180x180), icon-192, icon-512, and favicon.ico. |
| `banner.png` | 2172 × 724 px, 8-bit RGB | None (opaque `#11141a`) | 1,089,308 B | 3:1 landscape repo banner. High-resolution reference for palette, typography, and layout. |

### Brand Wording and Licensing Policy
- **Mascot**: Unnamed guide character (warmth without cartoon speech bubbles).
- **Brand Licensing**: The Reqnx code is licensed under MIT. Reqnx brand assets (logo, mascot, character art, illustrations) are copyright the project maintainers, reserved for official project distribution, and not licensed under MIT without express permission.
- **Audience**: Backend engineers and TypeScript API teams requiring predictable, atomic rate limiting with pure state transitions and deterministic clocks.

---

## 2. Repo Audit & Feature Availability
- **Shipped & Available**:
  - `fixed-window`: Pure state machine with epoch alignment (`packages/core/src/algorithms/fixed-window.ts`).
  - `token-bucket`: Shipped and tested in Core (`packages/core/src/algorithms/token-bucket.ts`), reconciled in `features.ts`.
  - `MemoryStore`: Synchronous, atomic in-memory store with LRU bounds (`packages/core/src/memory-store.ts`).
  - Core Primitives: Injected Clock, Key Builder, Contract Testkit, Failure Policies, Header Converter.
- **Planned / Stubs**:
  - `sliding-window-log`, `sliding-window-counter`, `leaky-bucket` (Planned).
  - `@reqnx/redis` (Stub package, Day 6).
  - `@reqnx/express`, `@reqnx/fastify` (Stub packages, Day 7).

---

## 3. Algorithm Registry Coverage
- Both `fixed-window` and `token-bucket` are enabled for live browser demos in the scenario engine.
- Default configs:
  - Fixed Window: `{ limit: 5, window: '10s' }`
  - Token Bucket: `{ capacity: 10, refillRate: 2, interval: '1s' }`
- Signatures:
  - `fixed-window-burst`: Demonstrates quota exhaustion and rollover.
  - `token-bucket-burst`: Demonstrates initial burst consumption and continuous refill.

---

## 4. Art Direction & Design Tokens
- **Concept**: "An instrument, not an illustration." Precision lab instrument feel with dark charcoal canvas (`#090a0f`), 1px hairline coordinate grids, and tabular telemetry rows.
- **Motif**: "Window Tick" — vertical and horizontal hairline coordinate grid with emphasized ticks for aligned time windows.
- **Brand Palettes**:
  - Electric Cyan (`#14ddfd` / `#17dafb`): Primary accent, allowed request dots, active tabs, timeline cursor.
  - Amber Gold (`#fcb020` / `#fdb021`): Secondary accent, token badges, burst limit warnings.
  - Dark Charcoal (`#111319`): Instrument panels and dark canvas.
  - Light Mode Accent: Cyan-Teal (`#0284c7`, 4.8:1 contrast against white) for text, retaining electric cyan for instrument borders.

---

## 5. Page Anatomy (Order is Fixed)
1. **Header**: Logo, version chip, navigation (Docs, Algorithms, Playground, Status, GitHub), 3-state theme toggle, Get started CTA.
2. **Hero**: Eyebrow, H1 ("Rate limiting built from small, checkable parts"), subhead, CTAs, copyable from-source command, mascot co-pilot, and live console island.
3. **Proof Strip**: 4-6 build-time verified facts computed by `facts.ts` (0 dependencies, dual ESM/CJS, bundle size, 14 ADRs, 2/5 available algorithms, memory throughput).
4. **What It Is**: Plain-language orientation, Decision card breakdown, 3 challenge cards (Time, Concurrency, Failure).
5. **Why Choose**: 12-column Bento grid of architectural guarantees, 3-layer category diagram (Edge vs Gateway vs App), honest "Not the right tool if" list.
6. **The Seam**: 3-frame build-time engine figure showing 2x boundary burst (10 allowed in 80ms) and how continuous algorithms avoid it.
7. **Algorithms**: ARIA-accessible tabs over all 5 algorithms with trait chips, complexity, and status badges.
8. **Quickstart**: Two-column layout with code tabs (Core, Express, Fastify, Redis) and verified offline output fixture.
9. **Recipes**: Real tested recipe cards with real Decision outputs (Login protection, Public API quota, Token bucket burst).
10. **Architecture**: Interactive theme-aware SVG system flow (App -> Limiter -> Store -> Pure Step / Lua -> Decision).
11. **Status (`#status`)**: Progress meter, feature availability list with evidence links, and unverified list.
12. **FAQ**: Native `<details>`/`<summary>` accordion with 14 deep technical answers.
13. **Open Source & Decision Log**: MIT statement, repository links, recent 5 ADRs with total count, mascot cameo.
14. **Final CTA**: Closing band with window-tick motif, large mascot, H2 "Try it before you install it", CTAs, and copyable run command.
15. **Footer**: Logo, columns (Project, Source), version, build date, brand asset license note, trademark disclaimer, "No cookies. No tracking.", theme toggle.
16. **404 Page (`src/pages/404.astro`)**: Branded recovery page with the distress mascot illustration, pathname inspection, and route suggestions.

---

## 6. Verification & Budgets
- **JS gzip**: Hero island + core + engine $\le 35\text{ KB}$; total landing JS $\le 60\text{ KB}$.
- **CSS gzip**: $\le 30\text{ KB}$.
- **Images above fold**: $\le 150\text{ KB}$.
- **Total transfer**: $\le 350\text{ KB}$ (excluding fonts).
- **Lighthouse mobile**: Performance $\ge 95$, Accessibility $= 100$, Best Practices $\ge 95$, LCP $\le 1.8\text{ s}$, CLS $\le 0.02$.
