# Documentation Visual & Interaction Design Concepts

**Document**: `docs/site/redesign-concepts.md`  
**Status**: Stage 2 Specification (Approved for Execution)  
**Target Surface**: REQNX Documentation (`apps/site` / Starlight)  
**Theme**: "The Instrument" — Precision Engineering Blueprint  
**Date**: October 2026  

---

## 1. Visual Direction & Design Philosophy

### The Instrument Philosophy
REQNX is a high-precision, predictable rate-limiting engine designed for systems engineers, backend architects, and platform teams. The documentation site is **not** a marketing brochure; it is an **engineering instrument** and an **operational handbook**.

### Anti-Patterns Explicitly Banned
- ❌ **No gradient heroes or decorative mesh blobs** (distracts from technical reading).
- ❌ **No oversized border radii** (maintains structured, blueprint discipline; maximum radius 10px).
- ❌ **No low-contrast text** (WCAG AAA target for body prose, minimum AA 5.5:1 for secondary labels).
- ❌ **No decorative illustrations or cartoon mascots** (replaced by functional architectural schematics and data matrices).
- ❌ **No unverified marketing superlatives** (strictly adhere to `claims.md` and `features.ts`).

### Core Aesthetic Pillars
1. **Precision & Structure**: 1px subtle borders (`--rx-border-subtle`), technical hairlines, and the window-tick grid motif subtly grounding header sections.
2. **Typography as Structure**: Technical JetBrains Mono headings (`--rx-font-mono`) paired with legible, optically paced Inter prose (`--rx-font-sans`), with strict tabular numerals (`font-variant-numeric: tabular-nums`) across all data, timestamps, and parameters.
3. **Dual-Coded Signaling**: Every status, severity, and decision outcome is encoded by **color AND shape/text** (e.g., emerald pill with checkmark for `Available`, rose pill with octagonal slash for `Denied`), ensuring accessibility under all lighting and color-vision conditions.
4. **Ergonomic Reading Geometry**: A disciplined 3-column layout where the center prose column is strictly constrained to **65–72 characters (max 68ch)** to eliminate eye tracking fatigue, while data tables and interactive playgrounds gracefully break out up to **1.25×** width.

---

## 2. Color Palette & Surface Hierarchy

### Dark Mode (Primary Canvas)
Matches developer IDEs and terminal environments:
- **Canvas Base (`--rx-surface-1`)**: `#0f1117` — deep charcoal slate.
- **Surface 2 (Cards, Sidebar, Panels) (`--rx-surface-2`)**: `#161923` — raised panel elevation.
- **Surface 3 (Code Blocks, Inset Stages) (`--rx-surface-3`)**: `#1e2230` — sunken stage background.
- **Surface 4 (Hover / Active Highlights) (`--rx-surface-4`)**: `#282d40` — interactive feedback surface.
- **Text Primary (`--rx-text-1`)**: `#f8fafc` — crisp white, 15:1 contrast against canvas.
- **Text Secondary (`--rx-text-2`)**: `#cbd5e1` — soft slate for prose, 11:1 contrast.
- **Text Muted (`--rx-text-3`)**: `#94a3b8` — metadata, captions, timestamps, 6.5:1 contrast.
- **Accent Primary**: Indigo `#4f46e5` / Cyan `#14ddfd` for technical highlights and active indicators.

### Light Mode (Daylight Calibration)
High-contrast, clean technical paper feel:
- **Canvas Base (`--rx-surface-1`)**: `#f8fafc` — slate-50 background.
- **Surface 2 (Cards & Sidebar) (`--rx-surface-2`)**: `#ffffff` — clean white card surfaces.
- **Surface 3 (Code & Stages) (`--rx-surface-3`)**: `#f1f5f9` — slate-100 structured background.
- **Surface 4 (Hover & Borders) (`--rx-surface-4`)**: `#e2e8f0` — slate-200.
- **Text Primary (`--rx-text-1`)**: `#0f172a` — slate-900, 16:1 contrast.
- **Text Secondary (`--rx-text-2`)**: `#334155` — slate-700, 9.5:1 contrast.
- **Text Muted (`--rx-text-3`)**: `#475569` — slate-600, 6.2:1 contrast.
- **Accent Primary**: Deep Indigo `#4338ca` / Sky `#0369a1` meeting strict WCAG AA/AAA.

---

## 3. Typographic System & Hierarchy

```text
Display / Page H1:   JetBrains Mono, 600 weight, 2.25rem (36px), line-height 1.2, letter-spacing -0.025em
Section H2:          JetBrains Mono, 600 weight, 1.625rem (26px), line-height 1.25, letter-spacing -0.02em
Subsection H3:       JetBrains Mono, 600 weight, 1.25rem (20px), line-height 1.3
Minor Heading H4:    JetBrains Mono, 500 weight, 1.0625rem (17px), line-height 1.35
Prose Body:          Inter, 400 weight, 1rem (16px), line-height 1.65, max-width 68ch
Technical Monospace: JetBrains Mono, 400/500 weight, 0.875rem (14px), tabular-nums
Captions & Eyebrows: JetBrains Mono, 600 weight, 0.75rem (12px), uppercase, letter-spacing 0.08em
```

---

## 4. Layout Architecture & Geometry

### 3-Column Desktop Grid (`>= 1280px`)
- **Left Column (Navigation Sidebar)**: Fixed `272px`. Sticky position, scrollable, grouped by the 6 top-level areas with item count badges and active cyan indicator.
- **Center Column (Prose & Technical Artifacts)**: Max `68ch` for body text (~680px), centered with flexible margins. Breakout elements (tables, playground, code blocks) expand to `100%` of container (~960px).
- **Right Column (Table of Contents & Quick Actions)**: Fixed `240px`. Sticky rail featuring:
  1. Active section scrollspy with hairline progress marker.
  2. "Copy as Markdown" quick action button.
  3. "Edit on GitHub" link.
  4. Algorithm traits quick pill (on algorithm pages).

### 2-Column Tablet Grid (`1024px – 1279px`)
- Left sidebar preserved at `250px`.
- Center content takes remaining width.
- Table of contents converts to a sticky floating top pill with instant popover menu.

### 1-Column Mobile Grid (`< 1024px`)
- Clean, uncluttered 52px header with Brand logo, Search trigger, and Drawer toggle.
- Full-screen focus-trapped drawer navigation with instant area tabs.
- Horizontal scroll wrappers with gradient edge masks for tables and code snippets.
- Touch targets strictly `>= 44px`.

---

## 5. Component Inventory & Specification

### 1. `StatusChip`
- **Purpose**: Displays feature status (Available / In Progress / Planned) strictly synchronized with `features.ts`.
- **Anatomy**: Small pill with status dot/icon, monospace label, and optional tooltip linking to the claims ledger.
- **Variants**:
  - `available`: Emerald dot + "Available" (`--rx-semantic-allowed-surface`).
  - `in-progress`: Amber pulse dot + "In Progress" (`--rx-semantic-warn-surface`).
  - `planned`: Slate outline + "Planned" (`--rx-semantic-neutral-surface`).

### 2. `AtAGlance`
- **Purpose**: High-density algorithm summary panel positioned directly below page title.
- **Anatomy**: 4–5 metric cells arranged in a grid:
  - **Memory Overhead**: e.g., `$O(1)$` per key / 64 bytes.
  - **Time Complexity**: e.g., `$O(1)$` amortized.
  - **Burst Allowance**: Yes / Strict Window / Configurable.
  - **Boundary Behavior**: Hard Reset / Smooth Sliding.
  - **State Storage**: Redis Key / Memory Map.

### 3. `DecisionFields`
- **Purpose**: Interactive/tabular specification of the `Decision` object fields (`allowed`, `remaining`, `resetAtMs`, `retryAfterMs`).
- **Anatomy**: Field name with type badge, requirement flag, default value, and contextual explanation with millisecond precision notes.

### 4. `ConfigTable`
- **Purpose**: Type-safe table documenting configuration options with parameter name, type, default, validation constraints, and code snippet.

### 5. `InstallSnippet`
- **Purpose**: Synced package manager snippet with tabs for `npm`, `pnpm`, `yarn`, and `bun`.
- **Behavior**: Selected tab state persisted in `localStorage` across all pages. Copy button with polite checkmark confirmation.

### 6. `AdrCard`
- **Purpose**: Standardized executive summary for Architecture Decision Records.
- **Anatomy**: Top banner displaying ADR ID, Title, Status badge (`Accepted`, `Superseded`, `Proposed`), Date, Deciders, and 1-sentence impact statement.

### 7. `MermaidViewer`
- **Purpose**: Clean, accessible rendering of architectural diagrams (`graph TD`, `sequenceDiagram`) with light/dark theme adaptation, fallback code toggle, and zoom support.

### 8. `PlaygroundEmbed`
- **Purpose**: Inlined interactive scenario runner demonstrating rate limiter behavior under concurrent requests with live visual timeline.

### 9. `CopyMarkdownButton`
- **Purpose**: In-page button allowing developers to instantly copy the current documentation page as clean Markdown for AI context prompts or offline reference.

---

## 6. Motion & Micro-Interactions

- **Hover Transitions**: Snappy 120ms standard ease (`--rx-dur-fast: 140ms var(--rx-ease-out)`) on cards, chips, and links.
- **Drawer & Modal Motion**: Smooth 200ms spring curve for mobile navigation sheet and search dialog.
- **Copy Confirmation**: Micro pulse transition with checkmark icon swap, resetting after 1800ms.
- **Reduced Motion**: Full graceful degradation adhering strictly to `prefers-reduced-motion: reduce` (zero animations, instantaneous state changes).

---

*End of Design Concepts Specification.*
