# Button System: Architecture Plan & Specification

> **Approved at Gate 1** on branch `button-system`.
> Authoritative specification for all buttons, button-like links, and segmented controls across the site.

---

## 1. Inventory of Interactive Controls

| Location | Element | Action / Purpose | Current Implementation | Target Component | Notes & Non-Button Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Header** | `<a>` | Skip to content | `.rx-skip-link` | `Button` (link/special) | Kept as accessible skip link; styled with button tokens. |
| **Header** | `<a>` | Navigate to `/` | `.rx-header__brand a` | Brand Link | Semantic logo link (not a button). |
| **Header** | `<a>` (×4) | Nav items (Docs, Algos, etc.) | `.rx-header__nav-link` | Nav Link | Navigation links (not buttons; sliding pill tracks them). |
| **Header** | `<a>` | External GitHub link | `.rx-header__nav-link--github` | Nav Link | Semantic external link with icon & screen-reader hint. |
| **Header** | `<button>` | Cycle theme | `ThemeToggle.tsx` | `SegmentedControl` | Replaces cycling button with accessible 3-state radio segmented control. |
| **Header** | `<a>` | Primary header CTA | `.rx-header__cta` | `Button` | `href="/getting-started/"`, `variant="primary"`, `size="sm"`. |
| **Header** | `<button>` | Toggle mobile drawer | `#rx-menu-toggle` | `IconButton` | `variant="tertiary"`, `size="sm"`, `aria-expanded`, `aria-controls`. |
| **Header Drawer** | `<a>` | Drawer primary CTA | `.rx-mobile-sheet__cta` | `Button` | `variant="primary"`, `size="md"`, `block={true}`. |
| **Hero** | `<a>` | Get Started primary | `.rx-btn.rx-btn--primary` | `Button` | `href="/getting-started/"`, `variant="primary"`, `size="lg"`, trailing arrow icon. |
| **Hero** | `<a>` | Playground secondary | `.rx-btn.rx-btn--secondary` | `Button` | `href="/playground/"`, `variant="secondary"`, `size="lg"`. |
| **Hero** | `<code>` | Inspect install command | `.rx-cmd-box__code` | Code Container | Focusable readout (not a button). |
| **Hero** | `<button>` | Copy terminal command | `CopyButton.tsx` | `CopyButton` | Unified system copy island (`size="sm"`, live region, icon morph). |
| **Live Console** | `<button>` (×5) | Switch algorithm tabs | `.rx-console__tab` | Tab Triggers | **Not buttons**: Stays ARIA `role="tab"` with `aria-selected` in `tablist`. |
| **Live Console** | `<button>` | Send single request | `.rx-btn.rx-btn--primary` | `Button` (Preact) | `variant="primary"`, `size="sm"`, triggers simulated tick. |
| **Live Console** | `<button>` | Send request burst | `.rx-btn.rx-btn--secondary` | `Button` (Preact) | `variant="secondary"`, `size="sm"`, triggers burst. |
| **Live Console** | `<button>` | Play/Pause simulation | `.rx-btn.rx-btn--ghost` | `ToggleButton` (Preact) | `variant="tertiary"`, `size="sm"`, `aria-pressed`. |
| **Live Console** | `<button>` | Reset simulation clock | `.rx-btn.rx-btn--ghost` | `Button` (Preact) | `variant="tertiary"`, `size="sm"`. |
| **Live Console** | `<button>` | Toggle decision log table | `.rx-console__log-toggle` | `Button` (Preact) | `variant="tertiary"`, `size="sm"`, `aria-expanded`. |
| **Landing Bento** | `<a>` (×3) | Deep-dive code links | `.rx-bento-link` | Inline Action Link | Text links with external icon (stays inline links). |
| **Algorithm Tabs** | `<button>` (×5) | Switch algorithm panel | `.rx-tab-btn` | Tab Triggers | **Not buttons**: Stays ARIA `role="tab"` in `tablist`. |
| **Algorithm Tabs** | `<a>` (×2) | View source code | `.rx-panel-link` | Inline Action Link | External links to GitHub implementations. |
| **Quickstart** | `<button>` (×4) | Code variant tabs | `.rx-qs-tab-btn` | Tab Triggers | **Not buttons**: Stays ARIA `role="tab"` in `tablist`. |
| **Quickstart** | `<button>` (×4) | Copy code snippet | `CopyButton.tsx` | `CopyButton` | Unified system copy button (`size="sm"`). |
| **FAQ** | `<summary>` (×9)| Expand FAQ answer | `.rx-faq-summary` | Disclosure Trigger | **Not buttons**: Native HTML `<summary>` inside `<details>`. |
| **Open Source** | `<a>` | Primary repo CTA | `.rx-btn.rx-btn-primary` | `Button` | `href={siteConfig.repo}`, `variant="primary"`, `size="md"`, external. |
| **Open Source** | `<a>` | View MIT license | `.rx-btn.rx-btn-outline` | `Button` | `variant="secondary"`, `size="md"`, external. |
| **Open Source** | `<a>` | View all ADRs | `.rx-adr-all-link` | `Button` | `variant="link"`, external. |
| **Final CTA** | `<a>` | Get Started primary | `.rx-btn.rx-btn--primary` | `Button` | `href="/getting-started/"`, `variant="primary"`, `size="lg"`, trailing arrow. |
| **Final CTA** | `<a>` | Playground secondary | `.rx-btn.rx-btn--secondary` | `Button` | `href="/playground/"`, `variant="secondary"`, `size="lg"`. |
| **Final CTA** | `<a>` | View on GitHub | `.rx-btn.rx-btn--ghost` | `Button` | `variant="tertiary"`, `size="lg"`, external. |
| **Footer** | `<a>` (×8) | Footer nav links | `.rx-footer__links a` | Footer Links | Semantic navigation anchors (not buttons). |
| **Footer** | `<button>` | Theme toggle | `ThemeToggle.tsx` | `SegmentedControl` | 3-state radio segmented control (System, Dark, Light). |
| **Footer** | `<button>` (×2)| Motion preference | `MotionControl.astro` | `SegmentedControl` | 2-state radio segmented control (System, Reduced). |
| **404 Page** | `<a>` | Return to home | `.rx-btn.rx-btn--primary` | `Button` | `href="/"`, `variant="primary"`, `size="md"`, trailing arrow icon. |
| **404 Page** | `<a>` (×3) | Quick nav suggestions | `.rx-link-secondary` | `Button` | `variant="link"` inline navigation links. |
| **404 Page** | `<a>` | Report broken link | `.rx-report-link` | `Button` | `variant="link"`, external. |
| **Playground** | `<input>` | Limit number input | `.rx-config-input` | Form Input | **Not a button**: Native number input. |
| **Playground** | `<select>` | Window select dropdown | `.rx-config-input` | Form Select | **Not a button**: Native select element. |
| **Playground** | `<button>` | Send manual request | `.rx-btn.rx-btn-primary` | `Button` (Preact) | `variant="primary"`, `size="md"`. |
| **Playground** | `<button>` | Reset playground | `.rx-btn.rx-btn-outline` | `Button` (Preact) | `variant="secondary"`, `size="md"`. |
| **Playground** | `<button>` (×4)| Run scenario presets | `.rx-btn.rx-btn-outline` | `Button` (Preact) | `variant="secondary"`, `size="sm"`, leading `play` icon. |
| **Dev Styleguide**| `<button>` (×4)| Legacy button samples | `.rx-btn.*` | Replaced | Migrates to dedicated `/dev/styleguide/buttons` matrix route. |
| **Starlight Docs**| `<button>` | Search modal trigger | `button.open-search` | Skinned | Styled via CSS tokens to match `Button` (`variant="secondary"`, `size="sm"`, `kbd` chip). |
| **Starlight Docs**| `<select>` / el | Theme selector | `starlight-theme-select`| Override / Skinned | Overridden to compose unified `SegmentedControl`. |
| **Starlight Docs**| `<button>` | Mobile sidebar toggle | `button[aria-controls]` | Skinned | Styled via CSS tokens to match `IconButton` (`variant="tertiary"`, `size="sm"`). |
| **Starlight Docs**| `<summary>` | Sidebar category toggle | `summary` | Disclosure Trigger | **Not a button**: Native details summary. |
| **Starlight Docs**| `<a>` (×2) | Previous / Next docs | `.pagination-links a` | Skinned | Styled via CSS tokens to match button system standards. |
| **Starlight Docs**| `<a>` | Edit page on GitHub | `.edit-page a` | Skinned | Styled via CSS tokens to match `Button` (`variant="link"`). |
| **Starlight Docs**| `<button>` | Code block copy button | `figure.expressive-code button` | Skinned | Styled via CSS tokens to match `IconButton` (`size="sm"`). |
| **Starlight Docs**| `<a>` | Starlight Hero actions | `.sl-link-button` | Skinned | Styled via CSS tokens to match `Button` primary/secondary. |

---

## 2. Reference Study: Button Systems

| System | Heights / Sizes | Radii | Hover / Pressed Treatment | Focus Ring Pattern | Icon Handling | Loading & Groups |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Linear** | 28, 32, 36, 40 px | 6 px, 8 px | Surface tint via alpha; active translateY 1px or scale 0.98 (80ms); flat, no gradient | Double outline (2px surface gap + 2px accent ring) | 14, 16, 18 px on grid; nudge on arrow | Spinner swaps icon; attached groups use sibling borders |
| **Stripe** | 32, 40, 48 px | 6 px, full | Solid fill; contrast >= 5:1; active brightness shift; 0 outer glow | 2px solid offset with high contrast | Fixed 16 px icon, optically centered | Locked width during loading; grouped buttons share divider |
| **Vercel Geist** | 32, 40, 48 px | 6 px | Strict monochrome inverse; hover alpha mix; instant tactile press | 2px focus ring with 2px offset; survives forced-colors | 16 px, currentColor, tight 6-8px gap | Dots/spinner replace leading icon |
| **GitHub Primer** | 28, 32, 40 px | 6 px | Explicit 1px border; 3:1 border affordance; active background darken | Outline + outline-offset 2px | Octicons with 8px margin; aligned to font-size | `aria-busy` with aria-live status; ButtonGroup container |
| **Radix Themes** | 1 (24), 2 (32), 3 (40), 4 (48) px | 6 px to full | Classic flat, soft, surface, outline, ghost variants; color-mix | High contrast Accent-9 ring | Slot-based leading/trailing icon | Prop-driven `loading` lock |
| **shadcn/ui** | sm (36), md (40), lg (44), icon | 6 px, 8 px | Background tinting via HSL; active scale/opacity | `ring-2 ring-offset-2` | Lucide SVG icons (16/18px) | Loading spinner replaces text or icon |

---

## 3. Design Spec & Tokens Specification

### Geometry Tokens
- `sm`: `min-height: 32px`, padding: `0 12px`, font: `0.8125rem` (13px), icon: `16px`.
- `md`: `min-height: 40px`, padding: `0 16px`, font: `0.875rem` (14px), icon: `18px`.
- `lg`: `min-height: 48px`, padding: `0 20px`, font: `1rem` (16px), icon: `20px`.
- Radius: `var(--rx-radius-sm)` (6px).
- Font weight: 550 to 600, line-height 1.25, `text-wrap: balance`.

### Colors & Hierarchy
- **Primary:** One per region. Option A approved: Flat fill (`var(--rx-accent-indigo)`), text `#ffffff`, inner highlight `inset 0 1px 0 rgba(255, 255, 255, 0.22)`.
- **Secondary:** Surface 2 (`var(--rx-surface-2)`), text `var(--rx-text-1)`, border `var(--rx-border-subtle)`.
- **Tertiary (Ghost):** Transparent background, text `var(--rx-text-2)`, hover `var(--rx-surface-3)`.
- **Link:** Text `var(--rx-accent-cyan)`, underlined on hover, zero padding.
- **On-Accent:** High contrast variants (`#ffffff` fill for primary, translucent fill with white border for secondary) over vibrant accent bands.
- **Focus Ring:** `outline: 2px solid var(--rx-accent-indigo); outline-offset: 2px;`.

---

## 4. Component Manifest & Contract

- Class: `.btn`
- Attributes:
  - `data-variant="primary | secondary | tertiary | link | on-accent-primary | on-accent-secondary"`
  - `data-size="sm | md | lg"`
  - `data-loading="true | false"`
  - `data-block="true | false"`
  - `data-icon-only="true | false"`
- Astro Components:
  - `Button.astro`
  - `IconButton.astro`
  - `ButtonGroup.astro`
  - `SegmentedControl.astro`
  - `Tooltip.astro`
- Preact Components:
  - `Button.tsx`
  - `IconButton.tsx`
  - `ToggleButton.tsx`
  - `CopyButton.tsx`
  - `SegmentedControl.tsx`

---

## 5. Starlight Integration Plan

- Skin search trigger, pagination links, and code block copy buttons using button CSS variables in `@layer components`.
- Component override for Starlight's `ThemeSelect` to compose the unified `SegmentedControl`.
- Preserve Starlight core search modals and table-of-contents navigation.

---

## 6. Enforcement & Verification

- CSS Lint: `apps/site/scripts/lint-css-buttons.ts`
- Source Lint: `apps/site/scripts/lint-source-buttons.ts`
- Built HTML Audit: `apps/site/scripts/audit-html-buttons.ts`
- Label Lint: `apps/site/scripts/lint-button-labels.ts`
- Visual Matrix: `/dev/styleguide/buttons`
- Target Size Checker: `apps/site/scripts/check-button-targets.ts`
- Contrast Checker: `apps/site/scripts/check-button-contrast.ts`
