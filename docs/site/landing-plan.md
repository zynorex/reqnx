# Day 3C: Landing Page Working Specification

> **Branch:** `day-3c-landing`  
> **Status:** Approved (Gate 1)

---

## 1. Reference Study (7 Sites)

| Site               | Best Aspect Learned                                                                          | Pattern Adopted vs Deliberately Avoided                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **redis.io**       | Immediate technical clarity; commands and throughput figures presented as bare facts.        | **Adopt:** Concrete CLI/API presentation without hype. **Avoid:** Busy multi-colored card taxonomy and legacy density.                                                                                                        |
| **cloudflare.com** | Dense network proof and rigorous edge terminology; authoritative tone.                       | **Adopt:** Evidence-backed metrics with transparent measurement methodology. **Avoid:** Generic corporate stock photography and vague marketing jargon.                                                                       |
| **upstash.com**    | Developer-first interactive consoles embedded directly on product pages.                     | **Adopt:** Live browser execution showing real state transitions. **Avoid:** Marketing-oriented pricing calculators and cartoon illustrations.                                                                                |
| **linear.app**     | Uncompromising craft in hairline borders, dark surfaces, and micro-interactions.             | **Adopt:** Razor-sharp 1px borders, subtle surface transitions (`surface-1` through `surface-4`), and tabular numerals. **Avoid:** Gratuitous glowing drop shadows and dark-only lock-in (supporting first-class light mode). |
| **stripe.com**     | World-class information hierarchy and simultaneous code + output presentation.               | **Adopt:** Split code + verified output panel with numbered callouts. **Avoid:** Heavy gradient mesh blobs and decorative isometric graphics.                                                                                 |
| **tailscale.com**  | Plain-spoken engineering honesty; clear architectural diagrams where every node has purpose. | **Adopt:** Clean inline SVG dataflow diagrams with real text and interactive inspection. **Avoid:** Consumer-style testimonial grids.                                                                                         |
| **hono.dev**       | Ultra-lightweight documentation aesthetics; instant comprehension for JS/TS developers.      | **Adopt:** Zero-runtime-overhead ethos and crisp monospace codeblocks. **Avoid:** Ad-hoc styling in favor of strict CSS layer tokens.                                                                                         |

---

## 2. Art Direction: "The Instrument"

### Concept: "An Instrument, Not an Illustration"

The page is designed like a high-precision digital oscilloscope or spectrum analyzer. It does not illustrate rate limiting through metaphors; it measures, charts, and renders rate-limiting decisions produced by the real `@reqnx/core` library. Visual hierarchy is established through tabular typography, hairline rules (1px), subtle border contrast, and discrete status indicators. Color is applied with restraint: neutral engineering slates provide the foundation, cool cyan and electric indigo guide the eye, and emerald/ruby semantic indicators signal state transitions without relying on color alone.

### Signature Motif: The "Window Tick"

A vertical time-grid motif evoking epoch-aligned time windows. Every sub-interval has a faint hairline tick, while window boundaries receive an emphasized taller tick with an epoch offset timestamp. This motif appears:

1. In the hero background (pure CSS repeating linear gradients with radial falloff mask).
2. As section dividing rules.
3. In the live console timeline and scenario replay widgets.
4. In the SVG favicon.

### Hero Compositions & ASCII Wireframes

#### Desktop (1440px) — Composition: "The Instrument Stage"

```
+--------------------------------------------------------------------------------------------------+
|  [Logo] REQNX  v0.0.0          Docs   Algorithms   Playground   Status   GitHub   [Theme] [Start]   |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|              [Chip: Open Source · MIT · Pre-release v0.x · Zero Dependencies]                     |
|                                                                                                  |
|                      Rate limiting you can reason about.                                         |
|         Pluggable algorithms running deterministic state transitions. Verified by               |
|         independent model tests. Zero runtime dependencies. Runs in your browser.                |
|                                                                                                  |
|                [ Get Started -> ]     [ Open Playground ]                                        |
|                $ git clone https://github.com/zynorex/reqnx.git [Copy]                           |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | [Fixed Window v] [Token Bucket (Planned)]   Limit: 5/10s   t = 12.4s   [● Live Simulation] |  |
|  |--------------------------------------------------------------------------------------------|  |
|  | TIMELINE (Shared engine):                                                [NOW]             |  |
|  |  |---W1 (0.0s)---|------------------------------------|---W2 (10.0s)---|----|               |  |
|  |  |  ●   ●   ●   ●   ●                            |  ●   ●   ◇   ◇   |                    |  |
|  |--+---+---+---+---+---+--------------------------------+---+---+---+---+----+--------------|  |
|  |  ALLOWED: 7    DENIED: 2    REMAINING: 0    RESET IN: 7.6s    PEAK (10s): 7 requests       |  |
|  |--------------------------------------------------------------------------------------------|  |
|  | [ Send Request ]  [ Send Burst (+7) ]  [ || Pause ]     [v] View Decision Log (9 entries)  |  |
|  +--------------------------------------------------------------------------------------------+  |
|             * Simulated time. This is the real @reqnx/core library running in your browser.       |
|                                                                                                  |
|  [ 0 Dependencies ]  [ ESM + CJS + Types ]  [ 2.4 kB Core (gzip) ]  [ 13 ADRs ]  [ 1/5 Available ]|
+--------------------------------------------------------------------------------------------------+
```

#### Mobile (390px) Wireframe

```
+-----------------------------------+
| [=] REQNX v0.0.0      [Theme] [>] |
+-----------------------------------+
| [ Open Source · MIT · v0.x ]      |
|                                   |
| Rate limiting                     |
| you can reason about.             |
|                                   |
| Deterministic state machines.     |
| Zero runtime dependencies.        |
|                                   |
| [ Get Started ]                   |
| [ Open Playground ]               |
|                                   |
| $ git clone ...reqnx.git   [Copy] |
|                                   |
| +-------------------------------+ |
| | Fixed Window (5/10s)  [● Sim] | |
| |-------------------------------| |
| | TIMELINE (44px touch-friendly)| |
| | W1 | ● ● ● ● ● | W2 | ● ◇ ◇   | |
| |-------------------------------| |
| | REMAINING: 0/5   RESET: 7.6s  | |
| | [ Request ]  [ Burst ]  [||]  | |
| +-------------------------------+ |
| * Simulated time (real library)   |
|                                   |
| [ 0 Runtime Dependencies ]        |
| [ 2.4 kB Core (gzip) ]            |
| [ 13 Architectural Decisions ]    |
+-----------------------------------+
```

### Design System Tokens

Layered architecture: `@layer reset, tokens, base, layout, components, utilities;`

- **Surfaces:** `--rx-surface-1` (canvas), `--rx-surface-2` (cards/panels), `--rx-surface-3` (raised stage/inputs), `--rx-surface-4` (hover/active).
- **Text:** `--rx-text-1` (headings/high emphasis), `--rx-text-2` (prose/subheads), `--rx-text-3` (timestamps/captions).
- **Semantics:** Dual-coded color + shape/text (`--rx-semantic-allowed`, `--rx-semantic-denied`, `--rx-semantic-neutral`).
- **Typography:** JetBrains Mono for headers/readouts/metrics; Inter for body prose.

---

## 3. Copy Deck (`landing.copy.ts`)

Centralized, typed copy deck with zero banned buzzwords, no exclamation marks, and no emojis:

- Primary Headline: **"Rate limiting you can reason about."**
- Primary Subhead: **"Pure state-transition functions running against your choice of storage. Five classical algorithms, zero dependencies, and deterministic tests that control time."**
- Secondary Option: **"Limit requests. Know exactly why."**

---

## 4. Component Inventory & Data Contracts

- `features.ts`: Extended with `evidencePath`, `traits`, and `signaturePreset`.
- `facts.ts`: Build-time computation of dependencies, export formats, bundle gzip size, ADR count, and available algorithms.
- `snippets/quickstart.output.json`: Verified runtime output generated by executing the quickstart snippet.
- Dev-only Styleguide: Available at `/dev/styleguide` during `astro dev`, produces empty array during production builds (`getStaticPaths` returns `[]`).

---

## 5. Verification & Budget Strategy

- **Test Suite:** Copy linting, status gating, hero scenario determinism, boundary story math, hard-coded string detection.
- **Visual Review:** Playwright screenshot matrix across 9 viewport widths (320px to 2560px) in both dark and light modes.
- **Performance Budgets:** Core+Engine+Hero island $\le 35\text{ KB}$ gzip; Total landing JS $\le 60\text{ KB}$ gzip; Lighthouse mobile targets $\ge 95$ Performance, $100$ Accessibility.
