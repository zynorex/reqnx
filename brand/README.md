# Reqnx Brand Assets

This directory contains the authoritative, master brand assets for Reqnx. All original files in this directory are read-only originals.

Derivatives are generated automatically by `pnpm --filter @reqnx/site run brand:build` and recorded in `brand/manifest.json`.

---

## 1. Inventory & Asset Roles

| File          | Role                               | Resolution     | Byte Size   | SHA-256 Checksum                                                   | Format     |
| :------------ | :--------------------------------- | :------------- | :---------- | :----------------------------------------------------------------- | :--------- |
| `logo.png`    | Primary brand icon / logo mark     | 1254 × 1254 px | 942,677 B   | `c71637396f8b354b4563896bbab7722fe3e336d8da826e8ccd8adcdda075d47f` | 8-bit RGB  |
| `mascot.png`  | Character mascot (guide character) | 1254 × 1254 px | 573,527 B   | `c8855876461d030ebd243baf3870ea1e8b25777b563291868941ec6dfa2e1855` | 8-bit RGBA |
| `404.png`     | 404 page illustration              | 1536 × 1024 px | 1,372,809 B | `62ba41ce2d693394293e69d219cf98fb15c63a675a6fb9184fb26c90a873d03a` | 8-bit RGBA |
| `favicon.png` | Favicon and app tile master        | 1254 × 1254 px | 986,013 B   | `dead0d2b3345cb7f9068f94065c5942e4e8ca2ed2f7b0f5bec785f8f59f816d0` | 8-bit RGB  |
| `banner.png`  | Social and repository banner       | 2172 × 724 px  | 1,089,308 B | `5e19bb6793dba0d36b04d2b04b5afcfe45a2040014cace0aae63785a69241390` | 8-bit RGB  |

---

## 2. Integrity & Regeneration

Integrity of the master assets is verified by:

```bash
pnpm --filter @reqnx/site test
```

To re-generate all derivatives and sync `brand/manifest.json`:

```bash
pnpm --filter @reqnx/site run brand:build
```

---

## 3. Usage Rules

### Clear Space

- Always maintain clear space around the logo equal to at least **half the logo height** (`0.5h`).
- For the mascot, maintain at least 24px of clear margin from adjacent text or interactive controls.

### Minimum Sizes

- **Logo icon**: Minimum display size 24 × 24 px.
- **Mascot**: Minimum display size 48 × 48 px (footer cameo) to preserve facial expressions and sunglasses detail; 240 px in hero / section contexts.
- **404 illustration**: Minimum display width 280 px on mobile, 480–560 px on desktop.

### Do

- Always use the typed descriptor exports from `apps/site/src/brand.ts`.
- Place the mascot beside content as a supportive guide (e.g. perching beside the live console or in open-source sections).
- Frame the logo in a dark squircle badge when placed on light backgrounds to preserve contrast without altering the asset.
- Keep aspect ratio locked (`1:1` for logo, favicon, and mascot; `3:2` for 404; `3:1` for banner).

### Don't

- **Never redraw, recolor, filter, distort, skew, or apply drop shadows** to the brand assets.
- **Never place the mascot inside data tables**, timeline panels, code blocks, or FAQ disclosures.
- **Never add speech bubbles**, conversational chat prompts, or jokes about unavailable features to the mascot.
- **Never crop awkwardly** through character faces or tokens.

---

## 3. License

The Reqnx software is licensed under the MIT License.
Reqnx brand assets (including `logo.png`, `mascot.png`, `404.png`, `favicon.png`, and `banner.png`) are copyright the project maintainers, reserved exclusively for official project distribution, and are not licensed under MIT without express written permission.

---

## 4. Planned Derivative Sizes

The `brand:build` pipeline generates:

- Favicon set: `favicon.ico` (16/32/48 multi-res), `apple-touch-icon.png` (180x180), `icon-192.png`, `icon-512.png`.
- Responsive WebP and AVIF derivatives for fast, bandwidth-conscious delivery.
- Future additions: 1200 × 630 px Open Graph / Twitter social preview card (derived from `banner.png` and `mascot.png`).
