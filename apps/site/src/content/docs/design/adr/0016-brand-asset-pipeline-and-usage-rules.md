---
title: "ADR 0016: Brand Asset Pipeline & Usage Rules"
description: "ADR 0016: Brand Asset Pipeline & Usage Rules documentation."
area: "design"
status: "available"
order: 16
---

<!-- @generated from docs/adr/0016-brand-asset-pipeline-and-usage-rules.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0016</span>
      <div class="rx-adr-title">ADR 0016: Brand Asset Pipeline & Usage Rules</div>
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

Reqnx maintains proprietary visual branding assets (`brand/logo.png`, `brand/mascot.png`, `brand/404.png`, `brand/favicon.png`, `brand/banner.png`). The software is MIT-licensed, but the brand assets are copyright the project maintainers and reserved for official distribution. Originals must never be modified, distorted, or re-generated. Downscaled derivatives must be generated automatically with SHA-256 integrity verification.

## Decision

1. **Source of Truth & Immutability**:
   - Master files reside in `brand/` at repository root and are read-only.
   - `brand/manifest.json` tracks SHA-256 checksums, byte dimensions, and color profiles. Automated unit tests fail if originals are altered without rebuilding the manifest.

2. **Derivative Pipeline**:
   - `pnpm --filter @reqnx/site run brand:build` utilizes `sharp` and `png-to-ico` to generate responsive WebP and PNG derivatives in `apps/site/src/assets/brand/`.
   - Multi-resolution favicon (`favicon.ico` containing 16x16, 32x32, 48x48) and `apple-touch-icon.png` (180x180) are emitted into `apps/site/public/`.
   - `site.webmanifest` links responsive icons and color themes.

3. **Mascot Placement Matrix**:
   - Mascot placement is strictly governed by `apps/site/src/brand.ts`:
     - `hero`: Supportive co-pilot peering over live instrument (hidden at $\le 900\text{px}$).
     - `section`: Small badge icon in Open Source section.
     - `cta`: Large companion in the final CTA banner.
     - `404`: Distressed mascot illustration with dropped coins on the recovery page.
     - `footer`: Mini 44px mark in footer navigation.
   - Mascot is forbidden from technical data tables, code snippets, algorithm comparisons, and the FAQ.

## Consequences

- Brand integrity is enforced by automated test assertions (`brand.test.ts`).
- Image transfer budgets remain well under the 150 KB above-the-fold threshold.
