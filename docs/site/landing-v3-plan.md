# Landing v3: Flagship Architecture Plan & Specification (Gate 1)

**Branch:** `landing-v3`  
**Status:** Gate 1 Review Specification  
**Reference Alignment:** Cloudflare Homepage ("Build for the agent era", October 2026) — adopting structure, craft, and rhythm; strictly our brand, our code, our evidence.

---

## 1. Parameters Table: Reference vs REQNX Design System

| Dimension / Element | Reference Value (Live Capture) | REQNX Token / Implementation | Rationale |
| :--- | :--- | :--- | :--- |
| **H1 Display Size** | `56px` / weight `500` / line-height `1.0` / `-0.025em` | `clamp(40px, 6.2vw, 72px)` / weight `500` / line-height `1.0` / `-0.03em` | Balanced 2–3 line editorial presence; LCP element |
| **H2 Section Headings** | `48px` / weight `500` / line-height `1.0` | `clamp(32px, 4.4vw, 48px)` / weight `500` / line-height `1.05` / `-0.025em` | Consistent section hierarchy across all bands |
| **Numerals (Stats)** | `64px`–`88px` / weight `500` tabular | `clamp(56px, 7vw, 88px)` / weight `500` tabular | Big computed numbers anchored in hairlines |
| **Body & Prose** | `16px` / `1.55` / `#262626` | `16px` / `1.55` / `--rx-text-2` (`#cbd5e1` dark, `#334155` light) | Crisp readability without pure harsh `#000000` |
| **Grid & Containers** | 12 columns / `1280px` max / `24px` gutter | 12 columns / `1280px` wide, `1080px` content, `720px` prose / `24px` gutter | 8px base spacing grid (`4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128`) |
| **Radii** | Full pill CTAs / `8px` cards | `4px` (small chips, kbd), `8px` (cards, console, terminal), `9999px` (pills) | Strict constraint: only 3 radii across the entire page |
| **Borders & Shadows** | `1px solid #e5e5e5` / No card shadows | `1px solid var(--rx-border)` / Zero shadows except 2px hero CTA lift | Flat, precision-engineered instrument feel |
| **Header Height** | `72px` transparent | `56px` (`52px` mobile), transparent on-hero, switching to blurred solid | Seamless integration with chrome specification |

---

## 2. Component Inventory & Data Contracts

| Component | Props / Input Contract | States / Variants | Accessibility Contract | Real Uses |
| :--- | :--- | :--- | :--- | :--- |
| `Section` | `id`, `label`, `h2`, `h2Muted?`, `lede`, `align: 'center' \| 'left'`, `sunken?: boolean` | Standard, Sunken, Full-bleed | Landmark sectioning, heading hierarchy | All sections (S1–S9) |
| `StatusPill` | `tag: string`, `label: string`, `href: string` | Hover, Focus | Accessible link with micro-label | Hero (S1), Status (S7) |
| `PillTabs` | `tabs: Array<{ id, label, disabled? }>`, `activeId`, `onChange` | Active (accent fill), Inactive (hairline) | `role="tablist"`, arrow key navigation, `aria-selected` | Tiers (S5), Console (S1) |
| `StatCell` | `numeral: number \| string`, `caption: string`, `sourceLabel: string`, `sourceHref?: string` | Omitted if fact missing | Tabular digits, source citation link | SpecGrid (S2), Race (S4) |
| `SpecGrid` | `stats: StatCellProps[]`, `pillars: PillarProps[]` | 3×2 Desktop, 1-col Mobile | Joined by 1px hairlines, semantic grid | Platform Section (S2) |
| `ArchitectureStage` | `store: 'memory' \| 'redis'`, `algorithm: string` | Interactive packet flow, gate recoil (E9, E20) | `role="img"`, complete text description, motion kill-switch aware | Platform Section (S2) |
| `EvidenceChip` | `claimId: string`, `label: string`, `href: string`, `status: 'passed' \| 'verified'` | Active, Hover, Focus | Accessible link to test/source file | Marquee (S3), Status (S7) |
| `EvidenceMarquee` | `chips: EvidenceChipProps[]`, `rows: 2` | Running, Paused (hover/focus/toggle) | `WCAG 2.2.2` pause button, static grid fallback | Proof Band (S3) |
| `DecisionQuote` | `decisionId: string`, `quoteText: string`, `adrTitle: string`, `adrHref: string` | Static card | Semantic `<blockquote>` with `<cite>` | Proof Band (S3) |
| `ContrastPanel` | `unsafeSnippet: string`, `atomicSnippet: string`, `unsafeCallouts: string[]`, `atomicCallouts: string[]` | Desktop 50/50, Mobile stacked | Distinct semantic labels (`danger` vs `success`) | Contrast Section (S4) |
| `RaceControl` | `limit: 100`, `requests: 1000`, `onRun: () => Promise<RaceResult>` | Idle, Simulating, Complete | Pre-rendered static result for No-JS | Contrast Section (S4) |
| `AlgorithmCard` | `id`, `name`, `status`, `headlineSpec`, `summary`, `bullets: string[]`, `href` | Available, Planned (muted) | Full card keyboard accessible, badge status | Tiers Section (S5) |
| `TerminalPanel` | `fixture: TerminalFixture`, `autoPlay?: boolean` | Sequenced line reveals, Complete | Static pre-render for No-JS, copy command button | Benefits (S6) |
| `Button (Pill)` | `data-shape="pill"`, `size="lg"` (48px) | Normal, Hover, Focus, Disabled | Target >= 44px, contrast >= 4.5:1 | CTAs, Tabs, Chips |

---

## 3. Layout & Aesthetic Standards Verification

- **Breakpoints**: `480px`, `768px`, `1024px`, `1280px`, `1536px`.
- **Max Containers**: Content `1080px`, Wide `1280px`, Narrow `720px`. Gutters `clamp(16px, 4vw, 48px)`.
- **Vertical Rhythm**:
  - Hero top: `80px` below header; Hero bottom: `64px` overlap by stage.
  - Standard sections: `clamp(72px, 9vw, 112px)` padding.
  - Dense sections (Proof, Status): `clamp(48px, 6vw, 72px)` padding.
  - Closing band: `clamp(96px, 12vw, 160px)` padding.
- **Typographic System**:
  - Exactly 9 font sizes: `72px` (Display XL), `48px` (Display L), `88px` (Numeral), `24px` (H3), `20px` (Card / Lede), `18px` (Lede mobile), `16px` (Body), `14px` (Small / Buttons), `12px` (Mono micro-label).
  - Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

---

## 4. Test & Quality Budget Plan

### Performance Budgets (Strict Landing v3 Standards)
- **Total Client JS (gzip)**: `<= 60 KB` (Islands lazy-load below the fold with `client:visible`).
- **Total Client CSS (gzip)**: `<= 30 KB`.
- **Fonts**: `<= 70 KB` (Inter + JetBrains Mono subsets).
- **LCP**: `<= 1.8 s` (Hero H1 rendered in static HTML, never animated in).
- **CLS**: `<= 0.02` (Fixed geometry frames and explicit aspect ratios).
- **TBT**: `<= 100 ms`.
- **Lighthouse Scores**: Performance `>= 95`, Accessibility `100`, Best Practices `>= 95`.

### Automated Verification Test Suite
1. `tests/race-simulation.test.ts`: Asserts deterministic results (RMW naive allows 1,000/100; REQNX atomic strictly allows 100/100).
2. `tests/verbatim-quote.test.ts`: Verifies decision quote text matches ADR-0002 file content character-for-character.
3. `tests/terminal-fixture.test.ts`: Validates schema, commit hash, date, and recorded test lines.
4. `tests/marquee-a11y.test.ts`: Tests pause button behavior, keyboard focus pause, and reduced-motion static fallback.
5. `tests/pill-tabs.test.ts`: Asserts keyboard arrows, Home, End, and roving tabindex.
6. `tests/facts-omission.test.ts`: Asserts stat cells are omitted if any computed fact returns null or throws.
7. `tests/no-borrowed-text.test.ts`: Banned-word audit asserting zero customer logos, SaaS pricing, Fortune stats, or reference phrases.
8. `tests/on-hero-contrast.test.ts`: Measures contrast ratios for all header elements in both themes.

---

## 5. Gate 1 Decisions & Approved Art Direction

### Decision 1: Hero Treatment
- **APPROVED: Option C (Quiet Canvas)**
- *Visual Demonstration*: See artifact `mock-option-c-1440-dark.png` and `mock-option-c-1440-light.png`.
- *Contrast Calculation*: H1 on Warm Cream (`#fffbf5`) with `#262626` ink reaches **14.8:1 AAA** contrast. Primary Indigo/Cyan Pill CTA reaches **7.4:1 AAA** contrast.
- *Rationale*: Option C integrates the hero smoothly into the rest of the canvas without an abrupt, disjointed contrast break. The accent is treated with restraint, reserved for interactive triggers (primary pill CTA and active tabs).

### Decision 2: Canvas Background
- **APPROVED: Warm Cream Canvas (`#fffbf5`) with Soft Warm Borders**
- *Palette Specs*:
  - Base canvas: `#fffbf5` (warm cream)
  - Sunken bands (proof band, unsafe card): `#f6f1e7`
  - Card & panel surfaces: `#ffffff`
  - Soft warm borders: `rgba(180, 160, 140, 0.22)` / `#e8e2d8`
  - Body text: `#262626` (slate-900 / warm charcoal)
  - Secondary text: `#525252`

### Decision 3: Fonts
- **Recommendation: Inter (500 display, 400 body) + JetBrains Mono (Micro-labels & Code)**
- *Rationale*: Fully open-licensed (OFL / Apache-2.0), pristine tabular numeral alignment, zero licensing friction.

### Decision 4: Button Geometry
- **Recommendation: Full Pill (`border-radius: 9999px`) for Primary CTAs, Chips, and Tabs**
- *Rationale*: Conveys flagship polish and instantly separates interactive triggers from structural card containers (which remain 8px).

### Decision 5: Proof Band Structure
- **Recommendation: Dual Marquee Rows (Opposing Directions) + Visible Pause Button**
- *Rationale*: Dynamic texture that celebrates developer evidence without customer testimonials. Fully accessible (`WCAG 2.2.2`).

### Decision 6: Time Scrubber
- **Recommendation: Fold into Tiers Section (S5)**
- *Rationale*: Keeps vertical rhythm tight and directly links time scrubbing to algorithm guarantees.

### Decision 7: Console Stage Placement
- **Recommendation: Straddling the Hero Bottom Edge (64px Overlap)**
- *Rationale*: Creates natural visual continuity and guides visitor scrolling into the platform architecture section.

---

## 6. Questions for User Approval

1. **Any wording required or strictly banned beyond the repo rules?**
2. **Default theme for first-time visitors**: Confirm whether system preference detection or dark mode default is preferred?
3. **Mascot Name**: Does our mascot character have an official name (e.g. "Rexy", "Quinn"), or should it remain uncaptioned?
4. **Anything specific from the reference you want kept or adapted differently?**
