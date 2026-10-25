# Landing v3: Reference Teardown & Brand Analysis

**Date:** October 19, 2026  
**Reference Site:** Cloudflare Homepage ("Build for the agent era", October 2026)  
**Methodology:** Automated Playwright capture at 1440×900, 1280×800, 768×1024, 390×844 following robots.txt terms. Single load, human-speed scroll, zero asset downloading. Raw capture artifacts saved to `.shots/reference/` (gitignored).

---

## 1. Verified Reference Measurements (Live Capture)

From live execution on `https://www.cloudflare.com/`:

| Dimension / Element | Measured Value | Notes |
| :--- | :--- | :--- |
| **Page Title** | `"Cloudflare: Build for the agent era"` | Single-claim orientation |
| **Header Height** | `72px` | Transparent background over hero (`rgba(0,0,0,0)`) |
| **H1 Display Size** | `56px` | Weight `500`, line-height `55.44px` (≈ 1.0), letter-spacing `-1.4px` (-0.025em) |
| **H1 Color** | `rgb(255, 255, 255)` (`#ffffff`) | Hero sits on a deep dark canvas |
| **H2 Section Headings** | `48px` | Weight `500`, line-height `48px` (1.0), color `rgb(38, 38, 38)` (`#262626`) |
| **Body / Prose Color** | `rgb(38, 38, 38)` (`#262626`) | Warm charcoal ink, never harsh `#000000` |
| **Canvas Background** | `rgb(255, 255, 255)` (`#ffffff`) | Clean canvas with subtle off-white/warm panels |
| **Loaded Typefaces** | `FT Kunst Grotesk (400, 500)`, `Apercu Mono Pro (400)`, `STK Bureau Sans (400, 500)` | Proprietary licensed grotesque + mono |
| **CTA Geometry** | Full pill (`border-radius: 9999px`) | Saturated accent background, high contrast |
| **Card Borders** | Hairline `1px solid #e5e5e5` | Subtle hairlines, minimal shadows |

### Resolution of Earlier Disagreements

1. **Hero Treatment Disagreement**:
   - *Previous uncertainty*: Full-bleed orange canvas vs dark `#262626` stage.
   - *Measured resolution*: The live flagship page uses a **Dark Stage** with pure white type (`rgb(255, 255, 255)`), high-contrast pill CTA, and transparent header over the hero band.
2. **Canvas Tone Disagreement**:
   - *Previous uncertainty*: Warm cream `#fffbf5` vs pure white.
   - *Measured resolution*: Main canvas is pure white (`#ffffff`) with subtle hairline structure and muted section bands.

---

## 2. Section Map & Anatomy (Top to Bottom)

1. **S0: Header (`72px`)**
   - Transparent over hero; pinned on scroll with blurred backdrop surface.
   - Brand mark, primary nav, right actions, primary pill CTA.
2. **S1: Hero Stage**
   - Pill status chip above H1 (`PRE-RELEASE` status pill).
   - One-claim H1 (editorial grotesque 500 weight, tight tracking, 2-3 lines).
   - One-sentence subhead (muted ink).
   - Dual actions: dominant pill CTA + quiet secondary text link.
   - Command chip (`npm i @reqnx/core` or run from source).
   - Product Stage: Live interactive console straddling the hero's bottom boundary.
3. **S2: Platform Section ("How it fits together")**
   - UI-native label chip (Store selector: Memory \| Redis).
   - H2 + lede.
   - Interactive Architecture SVG stage with packet transmission and gate recoil.
   - 3×2 Spec Grid joined by hairlines (Top row: 3 computed Stat cells; Bottom row: 3 Pillar cells).
4. **S3: Proof Band**
   - Centred heading: "Every item links to the code or test behind it."
   - Dual marquee tracks scrolling in opposite directions at constant slow speed with 96px edge fade masks.
   - Interactive Pause/Resume control (`WCAG 2.2.2` compliant).
   - Featured ADR Decision Quote card (verbatim test-verified quote from accepted ADR).
5. **S4: Contrast ("What a read-modify-write limiter gets wrong")**
   - Two-tone H2: Bold statement + muted parenthetical.
   - 50/50 dual panel: Naive non-atomic RMW pattern (sunken) vs Atomic step (raised).
   - "The Race" interactive simulation: "Send 1,000 at once" running real limiter vs simulated race.
6. **S5: Choose Your Guarantee (Tiers Section)**
   - Centred two-tone headline.
   - Pill category tabs (e.g. Exact, Burst Friendly, Cheap at Scale).
   - Plan-style AlgorithmCards with big headline specs (e.g. "exact", "2x - 1 burst", "2 integers").
7. **S6: Benefits Grid & Sequenced Terminal**
   - 5 structured benefit rows joined by hairlines.
   - Always-dark TerminalPanel with sequenced line output and copy command.
8. **S7: Status Matrix ("What works today")**
   - Two-column hairline list grouped by Available, In Progress, Planned.
9. **S8: Technical FAQ**
   - Sticky heading left, semantic `<details>/<summary>` list right.
10. **S9: Closing Band**
    - Full-bleed band echoing the hero.
    - Large mascot guide + dual CTAs + MIT open-source honesty notice.
11. **S10: Chrome SiteFooter**
    - Full structured footer with tick ruler and preferences.

---

## 3. What We Adopt vs What We Deliberately Avoid

| Feature | Reference (Cloudflare) | REQNX Implementation |
| :--- | :--- | :--- |
| **Headline Structure** | One-claim H1, tight tracking, editorial weight | **Adopted**: 500 weight, 56–72px, balanced 2–3 lines |
| **Stage Element** | Video loop / product showcase | **Adopted (Enhanced)**: Live interactive WASM/TS console running real `@reqnx/core` |
| **Proof Mechanisms** | Fortune 500 customer logos, client quotes | **DELIBERATELY AVOIDED**: Replaced with evidence chips, computed facts, and verbatim ADR quotes |
| **Visual Accents** | Saturated brand orange (`#ff4801`) | **Adapted**: Reqnx Electric Cyan (`#14ddfd`) and Deep Indigo (`#4f46e5`) |
| **Button Geometry** | Pill shape for primary actions | **Adopted**: Added `pill` shape to `@reqnx/site` button system |
| **Contrast Section** | Marketing comparison vs legacy clouds | **Adopted**: Engineering contrast (Atomic single-step vs Naive read-modify-write) |
| **Tiers / Pricing** | Dollar-tiered SaaS plans | **Adapted**: Guarantee-tiered algorithm selection (Exact vs Burst vs Memory) |

---

## 4. Brand Palette & Contrast Analysis

Our brand assets (`logo.png`, `mascot.png`) feature three dominant hues:
1. **Electric Cyan**: `#14ddfd`
2. **Deep Indigo / Blue**: `#4f46e5` / `#4338ca`
3. **Charcoal / Obsidian**: `#0f1117` / `#161923`
4. **Pure White**: `#ffffff`

### Contrast Matrix

| Pair | Luminance Ratio | WCAG Compliance | Viability Evaluation |
| :--- | :--- | :--- | :--- |
| **Option A (Voltage Canvas - Cyan `#14ddfd`)** + White text | `1.54 : 1` | **FAIL** (Needs 4.5:1) | ❌ Inviable with white text |
| **Option A (Voltage Canvas - Cyan `#14ddfd`)** + Dark text `#0f1117` | `12.7 : 1` | **PASS AAA** | ⚠️ Viable but visually aggressive for full hero |
| **Option B (Dark Stage `#0f1117`)** + White text `#ffffff` | `18.1 : 1` | **PASS AAA** (Max contrast) | ✅ **RECOMMENDED**: High impact, cinematic, fits console |
| **Option B (Dark Stage)** + Cyan Pill CTA with dark ink | `12.7 : 1` | **PASS AAA** | ✅ Exceptional focus and clarity |
| **Option C (Quiet Canvas `#ffffff`)** + Indigo Pill CTA with white text | `7.1 : 1` | **PASS AAA** | ✅ Clean, but less dramatic hero presence |

---

## 5. Gate 1 Decisions: Approved Art Direction

1. **Decision 1 (Hero Treatment): APPROVED OPTION C (Quiet Canvas)**
   - *Rationale*: Option C integrates the hero stage directly into the canvas without an abrupt full-bleed boundary break. The saturated brand accent is used with deliberate restraint, reserved for interactive triggers (primary pill CTA and active tabs).
   - *Contrast*: In light mode on warm cream (`#fffbf5`), `#262626` dark ink achieves **14.8:1 AAA** contrast. In dark mode, `#ffffff` text on `#0b0d13` achieves **18.1:1 AAA** contrast.
2. **Decision 2 (Canvas): APPROVED Warm Cream Canvas (`#fffbf5`) with Soft Warm Borders**
   - *Rationale*: Delivers a warm, editorial, and deeply tactile reading experience reminiscent of high-end technical publications, with `#fffbf5` base canvas and soft warm borders (`rgba(180, 160, 140, 0.22)`).
3. **Decision 3 (Fonts): Inter (Display & Body) + JetBrains Mono (Micro-labels & Code)**
   - *Rationale*: Open-licensed (OFL / Apache-2.0), already installed, impeccable tabular numeral rendering, and superb 500-weight display tracking.
4. **Decision 4 (Button Shape): Full Pill (`border-radius: 9999px`) for Primary CTAs, Chips, and Tabs**
   - *Rationale*: Distinctive, premium flagship geometry that immediately differentiates actions from cards and frames.
5. **Decision 5 (Proof Band): Dual Marquee Rows with Edge Masks & Visible Pause Control**
   - *Rationale*: Rich dynamic texture, deterministic evidence chips from the claims ledger, fully accessible with pause toggle and static reduced-motion fallback.
6. **Decision 6 (Time Scrubber): Fold into the Tiers Section (S5)**
   - *Rationale*: Directly pairs the chosen guarantee with interactive timeline scrubbing without bloating total page vertical height.
7. **Decision 7 (Console Stage Position): Straddling the Hero Bottom Edge (64px Overlap)**
   - *Rationale*: Bridges the hero into the platform section, guiding the eye smoothly downward.
