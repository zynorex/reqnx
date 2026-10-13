---
title: "ADR 0019: Unified Button System Architecture"
description: "ADR 0019: Unified Button System Architecture documentation."
area: "design"
status: "available"
order: 19
---

<!-- @generated from docs/adr/0019-unified-button-system.md - DO NOT EDIT DIRECTLY -->

## Status

Accepted

## Context

Prior to this decision, interactive controls across the documentation site, landing page, interactive console, and playground were developed independently. Various sections used disparate button classes, conflicting touch targets, divergent focus rings, and custom hover states. Additionally, Astro Starlight injected its own button styles in the documentation routes.

Infrastructure engineers expect clean, consistent, accessible, and high-performance user interfaces. To eliminate UI fragmentation, maintain strict WCAG 2.2 AA compliance, and enforce rock-solid semantic HTML across both static Astro pages and reactive Preact islands, a unified button system is required.

## Decision

1. **Semantic HTML Integrity**:
   - **Links navigate**: Any control specifying a destination (`href`) renders a semantic `<a>` tag with appropriate external destination detection (`target="_blank"` and `rel="noopener noreferrer"` for external targets, plus accessible screen-reader annotations).
   - **Buttons act**: Any interactive control performing an action in-place renders a `<button type="button">`.
   - Prohibited patterns: `role="button"` on anchors, `href="#"`, `javascript:void(0)`, and div/span click handlers.
   - Disabled anchors render `aria-disabled="true"` with no `href` and `tabindex="-1"`, remaining in the DOM for discoverability without triggering navigations.

2. **Visual Hierarchy & Aesthetics (Option A)**:
   - Primary buttons implement a flat brand fill (`var(--rx-accent-indigo)`) accented by a crisp 1px inner highlight: `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22)`.
   - Exactly **one** primary button is permitted per visual region (hero, header, card, console).
   - Secondary buttons use surface fill (`var(--rx-surface-2)`) with a subtle border.
   - Tertiary (ghost) buttons have transparent backgrounds with hover elevation.
   - On-accent variants (`on-accent-primary`, `on-accent-secondary`) provide guaranteed contrast on vibrant container backgrounds.

3. **Standardized Geometries & Coarse Touch Targets**:
   - Three standard heights:
     - `sm`: 32px height, 12px padding, 13px font size (`0.8125rem`).
     - `md`: 40px height, 16px padding, 14px font size (`0.875rem`) (default).
     - `lg`: 48px height, 20px padding, 16px font size (`1rem`).
   - Single border radius: `var(--rx-radius-sm)` (6px) across all variants.
   - Touch targets for coarse pointer devices (touchscreens) automatically expand to $\ge 44 \times 44\text{ px}$ via an invisible `::after` pseudo-element (`@media (pointer: coarse)`), ensuring WCAG 2.5.5 compliance without bloating visual layout.

4. **Two-Tone Focus Rings & Accessibility**:
   - Focus rings utilize an outline + outline-offset architecture (`outline: 2px solid var(--rx-accent-indigo); outline-offset: 2px;`) providing 3:1 contrast against both dark and light canvas backgrounds.
   - High contrast mode (`@media (forced-colors: active)`) explicitly maps to `ButtonText`, `Highlight`, and `HighlightText`.
   - Reduced motion preferences (`@media (prefers-reduced-motion: reduce)` and `html[data-motion="reduced"]`) disable icon translations and spring active depress animations.

5. **CSS Architecture & Layer Precedence**:
   - All button styling resides exclusively in `apps/site/src/styles/buttons.css` within `@layer components`.
   - Top-level document templates declare the layer sequence `@layer reset, tokens, base, layout, components, utilities;` in `<head>` to preserve cascade hierarchy across bundled chunks.
   - Global typography rules isolate link coloring via `a:not(.btn)` to prevent unlayered anchor styling from clobbering button text contrast.

6. **Automated Verification Pipeline**:
   - `lint:buttons`: Asserts zero button styling outside `buttons.css`, bans raw `<button>` without approval, and enforces sentence-case label conventions.
   - `audit:buttons`: Audits built HTML output to verify semantic tag mapping (`<a>` vs `<button>`) and accessibility attributes.
   - `buttons:targets`: Verifies minimum height and coarse touch target metrics.
   - `buttons:contrast`: Validates contrast ratios for all dark/light button states against WCAG 2.1 AA thresholds.
   - `buttons:a11y` & `run-a11y.ts`: Executes Axe Core automated audits across mobile and desktop viewports in dark and light modes with 0 allowed violations.

## Consequences

- Consistent, predictable interaction patterns across every page (landing, playground, console, 404, docs).
- Zero third-party UI framework or animation dependencies (under 2.5 KB gzipped CSS).
- Absolute WCAG 2.2 AA accessibility and contrast compliance verified on every CI build.
