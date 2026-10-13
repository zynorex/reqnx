---
title: "ADR 0017: Not Found Page & Route Manifest"
description: "ADR 0017: Not Found Page & Route Manifest documentation."
area: "design"
status: "available"
order: 17
---

<!-- @generated from docs/adr/0017-not-found-page-and-route-manifest.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0017</span>
      <div class="rx-adr-title">ADR 0017: Not Found Page & Route Manifest</div>
    </div>
    <span class="rx-adr-status rx-adr-accepted">
      <span class="rx-status-dot"></span>
      Accepted
    </span>
  </div>
  <div class="rx-adr-meta-grid">
    <div class="rx-meta-item">
      <span class="rx-meta-label">Status</span>
      <span class="rx-meta-value">Accepted</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Decision Date</span>
      <span class="rx-meta-value">2026-10</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Deciders</span>
      <span class="rx-meta-value">REQNX Architecture Team</span>
    </div>
  </div>
</div>

## Context

Reqnx requires a dedicated, branded 404 recovery page for the documentation site. The default 404 page provided by the Starlight theme uses generic typography and layout that does not match Reqnx's dark "Instrument" theme, does not incorporate the brand assets (`brand/404.png`), and provides no intelligent path recovery when developers arrive via broken external links or mistyped algorithm routes.

Additionally, static hosting environments (GitHub Pages, Cloudflare Pages, S3/CloudFront) require a single, standalone `404.html` at the build root rather than nested redirects.

## Decision

1. **Starlight 404 Override**:
   - Configured `disable404Route: true` in `apps/site/astro.config.mjs` to suppress Starlight's automatic 404 route generation.
   - Created `apps/site/src/pages/404.astro`, which compiles directly to `apps/site/dist/404.html`.

2. **Art Direction & Brand Asset Integration**:
   - Embeds the official 404 illustration (`brand/404.png`) via `brand.mascot404` descriptor in `apps/site/src/brand.ts`.
   - The artwork depicts the mascot with distressed expression and scattered rate-limit tokens, conveying that the requested resource could not be found.
   - Styled using the shared token system (`--rx-canvas-0`, `--rx-accent-cyan`, `--rx-accent-amber`, `--rx-border-subtle`) and the subtle coordinate grid tick motif.
   - Adheres to WCAG AA contrast standards ($\ge 4.5:1$) in both dark and light modes.

3. **Client-Side Fuzzy Path Recovery**:
   - A lightweight vanilla script executes on page load to inspect `window.location.pathname`.
   - Compares the requested path against a known route manifest:
     - `/` (Home)
     - `/docs/getting-started/` (Quickstart Guide)
     - `/docs/algorithms/fixed-window/` (Fixed Window Counter)
     - `/docs/algorithms/token-bucket/` (Token Bucket Algorithm)
     - `/playground/` (Interactive Simulator)
     - `https://github.com/zynorex/reqnx` (Source Repository)
   - If a close match is identified (via Levenshtein distance or segment prefix matching), a dynamic suggestion banner informs the user ("Did you mean /docs/algorithms/fixed-window/?") with a direct link.
   - If no close match is found, displays primary fallback pathways (Home, Getting Started, Playground, GitHub).

4. **Accessibility & Usability**:
   - Semantic HTML structure with proper landmark regions (`<main>`, `<nav>`).
   - Clear focus indicators and keyboard navigability for all recovery links.
   - Fully accessible with zero serious or critical Axe violations.

## Consequences

- Single static `404.html` deployed cleanly across all static hosting providers.
- Consistent developer experience and reduced bounce rate on mistyped URLs.
- Covered by the automated screenshot matrix (`404-desktop-1440-dark.png`, `404-mobile-390-dark.png`) and Axe automated audits.
