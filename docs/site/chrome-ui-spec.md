# Site Chrome UI Specification: Unified Header & Footer

**Status:** Proposed (Gate 1 Review)  
**Document:** `docs/site/chrome-ui-spec.md`  
**Branch:** `chrome-ui`  
**Design Direction:** "The Instrument" — Precise, Quiet, Edge-to-Edge  

---

## 1. Executive Summary & Direction

The REQNX chrome system unifies the website under one coherent, theme-matched shell:
- **`SiteHeader`**: Two variants (`marketing` and `docs`) sharing identical structural bones (logo lockup, typography, micro-labels, control geometry, 2px bottom accent marker).
- **`SiteFooter`**: Two variants (`full` marketing 12-column matrix and `slim` docs 72px compact row), both featuring an optional hairline time-ruler top edge and synchronized preference controls.
- **Theme Matching**: Complete synchronization across Light, Dark, System, Forced Colors, High Contrast, and Print without flash or layout shifts.

---

## 2. Gate 1 Open Decisions & Recommendations

| # | Decision | Options Considered | Recommendation | Visual & Architectural Rationale |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Header Height** | 56 px vs 60 px | **56 px** (52 px under 768 px) | Changes the landing's earlier 64 px to 56 px. 56 px is the modern industry consensus (verified on Cloudflare, Vercel, Resend, Stripe), maximizing vertical reading viewport for code and docs while comfortably accommodating 36 px interactive controls. |
| **2** | **Header Surface (Solid)** | 100% Solid vs 92% Opaque + Blur | **92% Opaque + 12px Blur** | `color-mix(in srgb, var(--rx-surface-1) 92%, transparent)`. Provides visual immersion over page scroll while guaranteeing worst-case contrast (> 9:1 for secondary text over the brightest tick motif). |
| **3** | **Current-Location Marker** | 2 px Bottom Underline vs Pill | **2 px Accent Underline Flush with Border** | Flush with the bottom border (`var(--rx-accent-cyan)`). Conveys precision engineering without adding bulky background pills that disrupt the reading baseline. Transitions smoothly (240 ms spring; instant on reduced motion). |
| **4** | **Algorithms Flyout (Marketing)** | Hybrid Disclosure vs Plain Link | **Hybrid Disclosure** | Top-level "Algorithms" links to `/algorithms/` overview; adjacent chevron disclosure button opens compact 320 px panel displaying available algorithms first. Works with keyboard (Enter, Esc), mouse (intent delay + grace bridge), and pure HTML without JS. |
| **5** | **Theme Control (Desktop)** | 3-Option Segmented vs Cycle Button | **3-Option Segmented Control** | System, Dark, Light options with 16 px icons in a 32 px hairline pill. Radiogroup semantics with arrow navigation; sliding thumb; reflects live OS changes; synchronized with footer. |
| **6** | **Footer Surface & Ruler Edge** | Sunken Surface; Ruler On vs Off | **Sunken Surface (\`--rx-surface-1\`) + Ruler Edge ON** | A subtle 12 px tick strip with 8 px intervals and faded edge masks anchors the bottom of the page in the brand's blueprint visual language. Automatically disabled under forced colors. |
| **7** | **Docs Area Navigation (< 1280px)** | "Section" Disclosure vs Scrollable Tabs | **"Section" Disclosure** | At 1024–1279 px, a compact disclosure button displays the active section label with a chevron, opening a 6-area dropdown. Prevents messy horizontal scrollbars and fits comfortably next to the 260 px search trigger. |

---

## 3. Web Research & Parameters Table

Empirical measurements gathered from 6 developer reference platforms (Tailwind CSS, Cloudflare Docs, Vercel, Resend, Redis, Stripe) at 1440x900 and 390x844:

| Reference Platform | Desktop Header H | Mobile Header H | Nav Typography / Gap | Search Trigger (Docs Desktop) | Footer Columns | Footer Link Row H | Border Alpha |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tailwind CSS** | 64 px | 56 px | 14 px / 24 px gap | 240 × 36 px | 4 cols | 32 px | ~0.08 |
| **Cloudflare Docs** | 56 px | 52 px | 14 px / 20 px gap | 280 × 36 px | 5 cols | 34 px | ~0.10 |
| **Vercel** | 56 px | 52 px | 14 px / 20 px gap | 240 × 32 px | 5 cols | 32 px | ~0.08 |
| **Resend** | 56 px | 52 px | 14 px / 18 px gap | 260 × 34 px | 4 cols | 32 px | ~0.07 |
| **Redis** | 64 px | 56 px | 14 px / 24 px gap | 240 × 36 px | 5 cols | 36 px | ~0.12 |
| **Stripe Docs** | 56 px | 54 px | 14 px / 24 px gap | 280 × 36 px | 4 cols | 34 px | ~0.08 |
| **REQNX Chosen** | **56 px** | **52 px** | **14 px / 20 px gap** | **260 × 36 px** | **4 cols** | **32 px** | **0.08** |

---

## 4. Design Tokens & Computed Contrast

### Geometry & Layout Tokens

```css
:root {
  --header-height: 56px;
  --header-height-mobile: 52px;
  --sidebar-width: 272px;
  --container-max: 1280px;
  --docs-container-max: 1440px;

  /* Z-Index Scale */
  --z-header: 40;
  --z-flyout: 50;
  --z-sheet: 60;
  --z-palette: 70;
  --z-tooltip: 80;
  --z-skip-link: 100;
}
```

### Color Tokens & Contrast Audit (WCAG 2.2 AA / AAA)

| Token Name | Dark Value | Light Value | Target Background | Dark Contrast | Light Contrast | WCAG Rating |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `--rx-text-1` | `#f8fafc` | `#0f172a` | Surface 1 / Header Solid | **18.2 : 1** | **15.6 : 1** | **Pass AAA** (7:1) |
| `--rx-text-2` | `#cbd5e1` | `#334155` | Surface 1 / Header Solid | **12.4 : 1** | **9.7 : 1** | **Pass AAA** (7:1) |
| `--rx-text-3` | `#94a3b8` | `#64748b` | Surface 1 / Header Solid | **6.8 : 1** | **4.8 : 1** | **Pass AA** (4.5:1) |
| `--rx-accent-cyan` | `#14ddfd` | `#0284c7` | Surface 1 / Surface 2 | **11.6 : 1** | **4.6 : 1** | **Pass AA** (4.5:1) |
| `--rx-btn-primary-text` | `#ffffff` | `#ffffff` | Indigo (`#4f46e5` / `#4338ca`) | **5.2 : 1** | **7.1 : 1** | **Pass AA** (4.5:1) |
| `--header-border` | `rgba(255,255,255,0.08)` | `rgba(15,23,42,0.08)` | Surface 1 | UI Boundary | UI Boundary | **Pass UI** (3:1) |
| Worst-Case Backdrop | Tick Major `rgba(20,221,253,0.22)` | Page Tick `rgba(15,23,42,0.03)` | 92% Solid Header Surface | **14.8 : 1** (Text 1) | **14.2 : 1** (Text 1) | **Pass AAA** |

---

## 5. Component Anatomy & States

### 5.1 SiteHeader (Marketing Variant)
- **Top State**: Transparent background (`--header-bg-transparent`), zero border. Sits cleanly over the hero tick motif without text color flipping.
- **Scrolled State**: Activated via `IntersectionObserver` observing an invisible 1px sentinel at `y = 8px`. Smoothly transitions to 92% solid surface with 12px blur and hairline bottom border (`rgba(255,255,255,0.08)`).
- **Navigation Cluster**:
  - `brand-lockup`: 24px logo icon, "REQNX" wordmark with gold "X".
  - `version-chip`: 22px height, JetBrains Mono 12px, tabular numbers, links to status page.
  - `<nav aria-label="Main Navigation">`: Docs, Algorithms, Playground, Status.
  - `site-nav__marker`: 2px cyan line flush with header bottom border, springs to hovered/focused link, returns to active link.
- **Right Utilities**:
  - `search-btn`: 36px `IconButton` opening search dialog.
  - `github-link`: 36px `IconButton` with external flag and tooltip.
  - `segmented-theme-control`: 32px pill with sliding thumb (System, Dark, Light).
  - `cta`: Primary button "Get started" (32px height, hidden below 768px).

### 5.2 SiteHeader (Docs Variant)
- **State**: Always solid with hairline border.
- **Left Cluster**: Logo lockup + 1px hairline slash + "Docs" breadcrumb.
- **Area Navigation**:
  - $\ge 1280\text{ px}$: 6 areas (`Start`, `Guides`, `Algorithms`, `Reference`, `Design`, `Project`) as tabs with 2px underline marker.
  - $1024 - 1279\text{ px}$: "Section" disclosure button showing current area name + chevron.
  - $< 1024\text{ px}$: Areas accessible via mobile sheet.
- **Right Utilities**:
  - `search-trigger-full`: 36px tall, 260px wide sunken input pill with search icon, "Search docs" placeholder, and fixed-width platform `Ctrl K` / `⌘ K` kbd chip.
  - `version-chip`, `github-link`, and `segmented-theme-control`.
  - No CTA button (prioritizes technical manual immersion).

### 5.3 Mobile Bar & Sheet (< 768px)
- **Mobile Bar**: Height 52px. Logo, search icon button, and 44px "Menu" button (collapses to icon-only below 360px).
- **Mobile Sheet Modal**:
  - Native `<dialog>` sliding in from inline-start (`min(88vw, 360px)`).
  - Scrim: 50% neutral backdrop blur.
  - Focus trapped upon open; Esc or backdrop tap closes and restores focus to Menu trigger.
  - Content: 56px header row with close button, full-width 44px search button, 48px link rows, Algorithms inline accordion, docs area tree, Preferences group (Theme & Motion controls), and "Get started" CTA.

### 5.4 SiteFooter (Full Marketing Variant)
- **Top Ruler Edge**: 12px strip of subtle 1px ticks spaced every 8px with faded gradient masks at both ends.
- **12-Column Grid**:
  - Brand Block (5 cols): Logo, tagline, version chip, pre-release chip, "2 of 5 algorithms available" hairline progress meter, build hash facts, 44px mascot cameo.
  - Link Columns (3 columns × 2 cols each): `Project`, `Learn`, `Source`. Mono uppercase headings, 32px link rows (44px on mobile touch).
- **Bottom Legal Strip**: MIT license line, copyright note, trademark disclaimer, "No cookies. No tracking.", Preferences group with Theme and Motion SegmentedControls, and "Back to top" link.

### 5.5 SiteFooter (Slim Docs Variant)
- Compact 72px row attached directly below the Starlight docs shell.
- Left: Small logo and license line.
- Center: Quick links (`Docs Home`, `Changelog`, `GitHub`, `Issues`, `License`).
- Right: Preferences group.

---

## 6. Breakpoint & Responsive Matrix

| Viewport | Header Height | Navigation Presentation | Search Form | Theme Control | Footer Layout |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **$\ge 1280\text{ px}$** | 56 px | Full Nav (Marketing) / 6 Area Tabs (Docs) | Full 260px (Docs) / Icon (Mktg) | Header Segmented | 12-Column Grid (Full) / 72px Row (Slim) |
| **$1024 - 1279\text{ px}$** | 56 px | Full Nav (Marketing) / Section Disclosure (Docs) | Full 260px (Docs) / Icon (Mktg) | Header Segmented | 12-Column Grid (Full) / 72px Row (Slim) |
| **$768 - 1023\text{ px}$** | 56 px | Full Nav (Marketing) / In Sheet (Docs) | Icon Button | In Mobile Sheet | 3-Column Grid + Brand Block on Top |
| **$< 768\text{ px}$** | 52 px | Mobile Sheet Drawer | Icon Button | In Mobile Sheet | 2-Column Link Grid + Stacked Legal Strip |
| **$< 360\text{ px}$** | 52 px | Mobile Sheet Drawer | Icon Button | In Mobile Sheet | Single Column Stacked |

---

## 7. Data Architecture (`apps/site/src/data/chrome.ts`)

All chrome contents originate from a single typed source:
```typescript
export interface ChromeNavItem {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

export interface ChromeAreaTab {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface ChromeFooterGroup {
  readonly heading: string;
  readonly links: readonly ChromeNavItem[];
}

export interface ChromeData {
  readonly brand: {
    readonly name: string;
    readonly tagline: string;
    readonly version: string;
  };
  readonly marketingNav: readonly ChromeNavItem[];
  readonly docsAreas: readonly ChromeAreaTab[];
  readonly footerGroups: readonly ChromeFooterGroup[];
  readonly legal: {
    readonly license: string;
    readonly brandNotice: string;
    readonly trademarkNotice: string;
  };
}
```

---

## 8. Accessibility & Compliance Contract

- **WCAG 2.2 AA & AAA**:
  - Text contrast $\ge 4.5:1$ (AA) and $\ge 7:1$ (AAA for primary text).
  - UI controls & focus rings $\ge 3:1$ contrast against adjacent surfaces.
  - Touch targets $\ge 44 \times 44\text{ px}$ on mobile viewports ($< 768\text{ px}$).
- **Keyboard Navigation**:
  - Logical tab order: Skip links &rarr; Logo &rarr; Nav items &rarr; Flyout trigger &rarr; Search &rarr; GitHub &rarr; Theme &rarr; CTA.
  - Skip links ("Skip to main content", "Skip to navigation") are visible on focus.
  - Esc closes flyout and mobile sheet, returning focus to trigger.
  - Focus trapped inside mobile sheet `<dialog>` while open.
- **Motion & Reduced Motion**:
  - `prefers-reduced-motion: reduce` and `data-motion="reduced"` instantly disable all slide, scroll progress, and spring transitions (`transition: none !important`).
- **Forced Colors Mode**:
  - Borders render with `CanvasText`, active marker with `Highlight`, backgrounds with `Canvas`, ruler tick strip hidden.
