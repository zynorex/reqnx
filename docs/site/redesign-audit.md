# Documentation UX & Visual Redesign Audit

**Document**: `docs/site/redesign-audit.md`  
**Status**: Stage 1 Deliverable (Approved for Redesign Execution)  
**Target Surface**: REQNX Documentation (`apps/site` / Starlight)  
**Date**: October 2026  
**Auditor**: Antigravity UX & Systems Team  

---

## 1. Executive Summary

This audit assesses the baseline user experience, visual design, information architecture, and technical reading ergonomics of the REQNX documentation site. While the underlying content and ingestion pipeline (24 ingested documents across algorithms, architecture, benchmarks, and ADRs) are robust and accurate, the current presentation relies on an uncustomized Starlight skeleton.

The docs currently present as a generic off-the-shelf documentation template rather than an **engineering instrument** worthy of a predictable, high-precision rate-limiting engine. The design fails to communicate product maturity, hides 85% of ingested pages behind a truncated sidebar, leaves technical architecture diagrams unrendered, and misses fundamental reading ergonomics benchmarks.

This audit establishes the empirical baseline, identifies the top 10 UX deficiencies with screenshot evidence, provides typographic and geometry measurements, and defines concrete redesign mandates for Stages 2 through 7.

---

## 2. Audit Methodology & Capture Matrix

The audit was executed against the local production-fidelity build across three canonical viewports and two theme modes:
1. **Desktop Light (1440 × 900 px)**: Primary evaluation canvas for daylight/enterprise workflows.
2. **Desktop Dark (1440 × 900 px)**: Native REQNX dark canvas matching developer IDE defaults.
3. **Mobile Viewport (390 × 844 px, iPhone 14/15 profile)**: Constrained reading and rapid lookup under handheld conditions.

### Screenshot Evidence Inventory
All artifacts are archived in the session artifact repository:

| Viewport & Page | Mode | Artifact ID / Reference | Primary Findings |
| :--- | :--- | :--- | :--- |
| **Getting Started** (1440px) | Light | `docs_getting_started_1440_1791863169454.png` | Default Starlight purple accent; loose heading-to-prose rhythm; sparse sidebar. |
| **Getting Started** (1440px) | Dark | `getting_started_dark_1791863708064.png` | Dark background `#17181c` disconnects from REQNX `--rx-surface-1` (`#0f1117`); un-themed code frame. |
| **Getting Started** (390px) | Mobile | `docs_getting_started_mobile_390_1791863762841.png` | Code block horizontal scroll clunky; theme toggle buried in hamburger; touch targets inconsistent. |
| **Algorithms Index** (1440px) | Light | `algorithms_page_top_1791863453557.png` | Unstyled raw markdown comparison table; emoji status ("✅") instead of dual-coded status chips. |
| **Algorithms Index** (1440px) | Dark | `algorithms_dark_1791863740744.png` | Table borders lack contrast; no sticky column headers on scroll; text density poorly paced. |
| **Algorithms Index** (390px) | Mobile | `algorithms_mobile_390_1791863770943.png` | Comparison table blows out mobile viewport horizontally with no visual affordance or pinning. |
| **Fixed Window** (1440px Top) | Light | `fixed_window_top_1791863500306.png` | Missing `AtAGlance` algorithmic property matrix; configuration table lacks type badges. |
| **Fixed Window** (1440px Scrolled) | Light | `fixed_window_scrolled_1791863505951.png` | Math equations lack visual framing; decision table lacks per-algorithm field highlights. |
| **Fixed Window** (390px) | Mobile | `fixed_window_mobile_390_1791863776744.png` | Formula clipping; table navigation tedious; TOC dropdown takes vertical screen real estate. |
| **ADR-0001 Page** (1440px) | Light | `adr_0001_page_1791863532409.png` | Raw markdown dump; no metadata header card (Status, Date, Deciders); unstyled consequences list. |
| **Playground** (1440px) | Light | `playground_audit_1791863558756.png` | Embed container lacks responsive wrapper; control panel unaligned with doc prose grid. |
| **Architecture** (1440px Top) | Light | `architecture_top_1791863582474.png` | **Critical**: Mermaid diagram renders as raw code block `graph TD ...` rather than visual flowchart! |
| **Architecture** (1440px Scrolled) | Light | `architecture_scrolled_1791863586930.png` | **Critical**: Mermaid sequence diagrams render as raw text blocks; wall-of-code fatigue. |

---

## 3. Reading Metrics & Ergonomic Measurements

### Typographic Analysis

| Metric | Measured Baseline | Ergonomic Standard | Delta / Evaluation |
| :--- | :--- | :--- | :--- |
| **Prose Column Width** | Variable `45rem`–`50rem` (~760px) | `65ch`–`72ch` (approx. 640px–680px) | **Excessive**: Up to 88–96 characters per line on wide viewports, inducing eye fatigue during technical reading. |
| **Base Font Size** | `16px` (`1rem`) | `16px` (`1rem`) | Optimal, but body line-height is generic `1.6` without fine optical sizing. |
| **Headings Typography** | System sans / Inter sans-serif | JetBrains Mono (`--rx-font-mono`) | **Off-brand**: REQNX design language specifies monospace titles for technical clarity and blueprint aesthetic. |
| **Heading Line Height** | `1.35`–`1.4` (Starlight default) | `1.2`–`1.25` balanced | Headings feel loose and disconnect from subsequent paragraph blocks. |
| **Heading Scale Ratio** | H1: `2.25rem` (36px), H2: `1.75rem` (28px), H3: `1.375rem` (22px) | Modern Modular Scale (1.25): H1: `2.25rem`, H2: `1.625rem`, H3: `1.25rem`, H4: `1.0625rem` | Steps are acceptable, but lack clear tracking (`letter-spacing: -0.02em`) and weight pacing. |
| **Inline Code Font** | Generic system monospace | `JetBrains Mono` with tabular numerals | Inconsistent vertical metric alignment with prose text. |
| **Contrast Ratios (Light)** | Text-1: `#23272f` (13.8:1), Text-2: `#6b7280` (4.6:1), Borders: `#e5e7eb` | Text-1: `>= 12:1`, Text-2: `>= 5.5:1`, Borders: `>= 2.5:1` | Text-2 barely clears WCAG AA; borders are too faint on high-DPI screens. |
| **Contrast Ratios (Dark)** | Text-1: `#f3f4f6` (14.2:1), Text-2: `#9ca3af` (5.8:1), Canvas: `#17181c` | Consistent with `--rx-surface-*` tokens | Disconnected from REQNX dark canvas palette (`#0f1117`, `#161923`, `#1e2230`). |

### Layout Geometry & Spatial Rhythm

| Component | Current Implementation | Redesign Requirement |
| :--- | :--- | :--- |
| **Layout Mode** | 2-column or fluid Starlight layout | Strict 3-column on desktop (`>= 1280px`): Sidebar `280px` + Prose `68ch` + TOC `240px`. |
| **Sidebar Width** | Fluid `18rem` (288px) | Fixed `272px` with category grouping and count chips. |
| **Table of Contents** | Starlight default right rail | Sticky right rail with scrollspy indicator, reading progress bar, and "Edit this page" / "Copy Markdown" links. |
| **Breakout Elements** | Blocked within prose column | Code blocks, benchmark graphs, and parameter tables break out up to `1.25×` prose width for scanning. |
| **Vertical Rhythm** | Inconsistent margins (`margin-top: 1.5rem`) | Tokenized 8-point vertical rhythm (`--rx-dist-sm`: 8px, `--rx-dist-md`: 12px, `--rx-dist-lg`: 16px, `--rx-dist-xl`: 24px, 32px, 48px). |

---

## 4. Top 10 UX Problems

### Problem 1: Unrendered Mermaid Diagrams (Catastrophic Visual Failure)
- **Artifact Evidence**: `architecture_top_1791863582474.png`, `architecture_scrolled_1791863586930.png`
- **Root Cause**: Architecture and ADR documents contain standard ` ```mermaid ` fences with flowcharts (`graph TD`) and sequence diagrams (`sequenceDiagram`). Astro/Starlight lacks a Mermaid parser integration, rendering these as walls of raw text strings.
- **User Impact**: Technical evaluators seeking to understand engine package boundaries and distributed store coordination encounter raw code instead of intuitive architectural diagrams.
- **Redesign Target**: Implement zero-dependency client/build rendering or clean SVG/Preact diagram components with interactive zoom, high-contrast dark/light themes, and accessible ASCII/text descriptions.

### Problem 2: Truncated Sidebar & Obscured Information Architecture
- **Artifact Evidence**: `docs_getting_started_1440_1791863169454.png`, `astro.config.mjs` lines 67–78
- **Root Cause**: The sidebar configuration in `astro.config.mjs` was statically pinned to 4 skeleton items (Home, Getting Started, Algorithms, Playground). None of the 24 ingested documents (ADRs 0001–0019, Architecture, Benchmarks, Token Bucket, Redis ports) are visible in the sidebar.
- **User Impact**: Users cannot discover 85% of the documentation through the navigation tree. Navigating between ADRs or reading related algorithm guides requires knowing direct URLs.
- **Redesign Target**: Full 6-area hierarchy configured in Starlight sidebar with collapsible groups: **Start** (4 pages), **Guides** (9 pages), **Algorithms** (5 pages), **Reference** (7 pages), **Design** (5 pages + ADR index), **Project** (4 pages).

### Problem 3: Generic Starlight Aesthetic Lacks Brand Identity
- **Artifact Evidence**: `docs_getting_started_1440_1791863169454.png`, `getting_started_dark_1791863708064.png`
- **Root Cause**: The documentation site does not map `--sl-*` variables to the REQNX design system tokens (`--rx-*`), nor does it load REQNX brand motifs (hairlines, window-tick grid, engineering blueprint typography). Default purple links and Astro badges dominate.
- **User Impact**: The docs look like a generic starter template rather than a mission-critical, enterprise-grade engineering tool.
- **Redesign Target**: Full mapping of `--sl-*` CSS variables to `--rx-surface-*`, `--rx-text-*`, `--rx-accent-indigo`, and `--rx-accent-cyan`. Introduce the subtle window-tick background on headers and custom branded breadcrumbs.

### Problem 4: Missing Algorithmic Quick-Reference & Status Truth
- **Artifact Evidence**: `algorithms_page_top_1791863453557.png`, `fixed_window_top_1791863500306.png`
- **Root Cause**: Algorithm pages display basic emoji text ("✅ Available") rather than the dual-coded `.rx-chip` component tied directly to `features.ts`. Furthermore, algorithmic traits (memory complexity, burst tolerance, boundary behavior, state size) are buried in body prose rather than summarized upfront.
- **User Impact**: Engineers selecting an algorithm must read several paragraphs across multiple pages to answer "does this algorithm support bursts?" or "what is the Redis memory overhead per key?".
- **Redesign Target**: Introduce the `AtAGlance` summary matrix at the top of every algorithm page and real `StatusChip` components (Available / In Progress / Planned) synchronized with `features.ts`.

### Problem 5: Raw Table Presentation & Mobile Clipping
- **Artifact Evidence**: `algorithms_page_top_1791863453557.png`, `algorithms_mobile_390_1791863770943.png`
- **Root Cause**: Markdown tables render as unadorned HTML `<table>` elements with default borders, no row striping, no tabular numeral alignment, and zero overflow handling on narrow screens.
- **User Impact**: On mobile viewports, tables stretch the page horizontally or clip without indication, breaking reading flow. On desktop, large parameter tables lack visual scannability.
- **Redesign Target**: Custom `ConfigTable` and responsive table wrapper with sticky column headers, subtle alternating zebra rows, tabular numeric alignment (`font-variant-numeric: tabular-nums`), and gradient fade indicators for horizontal mobile scrolling.

### Problem 6: Monotonous Code Presentation & Missing Ecosystem Synced Tabs
- **Artifact Evidence**: `docs_getting_started_1440_1791863169454.png`, `fixed_window_scrolled_1791863505951.png`
- **Root Cause**: Code blocks use default Expressive Code frames with basic grey chrome. Install snippets lack synchronized package manager tabs (`npm`, `pnpm`, `yarn`, `bun`), and runnable code blocks lack terminal output badges.
- **User Impact**: Developers have to manually translate package install commands. Long code examples blend into one another without distinct visual hierarchy between input command, configuration object, and return decision.
- **Redesign Target**: Synced package manager tabs with `localStorage` persistence, custom terminal titlebars with status lights, distinct visual differentiation for input vs output frames, and line-highlighting tokens.

### Problem 7: ADR and Architecture Pages Lack Executive Structure
- **Artifact Evidence**: `adr_0001_page_1791863532409.png`
- **Root Cause**: Ingested ADR markdown files render as plain heading/paragraph sequences. Critical decision metadata (Status: Accepted, Date: 2026-03, Deciders, Superseded By, Consequences summary) is rendered as standard bulleted text.
- **User Impact**: System architects evaluating past technical decisions must read the entire document to determine if an ADR is currently active, deprecated, or superseded.
- **Redesign Target**: Dedicated ADR page template with an executive metadata card at the top, visual status badge, structured Context/Decision/Consequences callouts, and two-way link to related ADRs.

### Problem 8: Clunky Theme Switcher & Visual Contrast Jumps
- **Artifact Evidence**: `getting_started_dark_1791863708064.png`, `docs_getting_started_1440_1791863169454.png`
- **Root Cause**: The default Starlight theme switcher uses a native HTML `<select>` dropdown labeled "Auto" that doesn't clearly indicate current state and flashes styles when toggling. Light mode secondary text (`#6b7280`) is borderline low-contrast.
- **User Impact**: In dark environments, toggling theme feels sluggish and visually jarring; in light environments, secondary metadata and captions suffer from reduced legibility.
- **Redesign Target**: Implement the custom `ThemeToggle` component with smooth micro-transitions, crisp high-contrast text (`--rx-text-1` through `--rx-text-3`), and explicit light/dark surface calibration.

### Problem 9: Mobile Ergonomics & Dense Header Chrome
- **Artifact Evidence**: `docs_getting_started_mobile_390_1791863762841.png`, `algorithms_mobile_390_1791863770943.png`
- **Root Cause**: Header chrome contains title, search button, language selector, social icons, and hamburger menu crammed into 56px height. The "On this page" TOC dropdown consumes significant vertical real estate above article content.
- **User Impact**: High accidental tap rate; limited initial viewport dedicated to actual technical documentation content.
- **Redesign Target**: Streamlined mobile header (Logo + Search icon + Menu trigger), minimum 44px tap targets, collapsible floating TOC pill, and smooth drawer navigation.

### Problem 10: Absence of Power-Reader Actions & Developer Utility
- **Artifact Evidence**: `docs_getting_started_1440_1791863169454.png`
- **Root Cause**: Standard page chrome offers only search and sidebar links. There is no instant "Copy page as Markdown" action for AI prompts or offline review, no one-click heading anchor copying with toast feedback, and no keyboard shortcut cheat-sheet.
- **User Impact**: Developers working alongside AI coding assistants or sharing specific sections cannot quickly extract documentation content or deep-links.
- **Redesign Target**: Implement "Copy as Markdown" action in page tools, hover anchor link with polite toast feedback, inline `<kbd>` components, and instant `Ctrl+K` search modal.

---

## 5. Architectural Redesign Mandates

Based on these audit findings, the implementation across Stages 2 through 7 will adhere to the following strict requirements:

1. **Design System & Starlight Alignment (Stage 2 & 3)**:
   - Override all `--sl-color-*`, `--sl-font-*`, and layout tokens in a dedicated `docs-theme.css` imported into `global.css`.
   - Implement typography matching "The Instrument": JetBrains Mono for headings and data, Inter for balanced prose, strict 68ch maximum reading column.

2. **Full Sitemap & Navigation Shell (Stage 4)**:
   - Expand `astro.config.mjs` sidebar to cover all 6 areas and 34 pages defined in `docs-plan.md`.
   - Add area header navigation pills (Start, Guides, Algorithms, Reference, Design, Project) linking directly to top-level sections.
   - Streamline mobile header with focus-trapped drawer.

3. **Component Suite Implementation (Stage 5)**:
   - `StatusChip`: Dual-coded, synchronized with `features.ts`.
   - `AtAGlance`: Algorithmic traits matrix with visual indicators.
   - `DecisionFields`: Canonical decision response schema inspector.
   - `ConfigTable`: Type-safe option table with defaults and constraints.
   - `MermaidViewer`: Safe build/client diagram renderer resolving Problem 1.
   - `AdrCard`: Executive summary header for ADR documents.
   - `InstallSnippet`: Synchronized package manager tabs (`npm`, `pnpm`, `yarn`, `bun`).
   - `PlaygroundEmbed`: Responsive frame for live scenario testing.
   - `CopyMarkdownButton`: Quick extraction tool for developer and LLM workflows.

4. **Performance & Accessibility Compliance (Stage 6 & 7)**:
   - Verify JS <= 25 KB gz (excluding search modal), CSS <= 30 KB gz.
   - Zero Lighthouse accessibility regressions (target: 100).
   - Ensure all 10 user tasks pass Playwright tests within their budgeted interactions.

---

*End of Audit Report.*
