# Stage 0 Chrome Baseline Metrics

**Date:** 2026-10-14T16:45:13.742Z
**Git Branch:** `chrome-ui`

## 1. Core Web Vitals & Ergonomic Performance

| Page | CLS (Cumulative Layout Shift) | FCP (First Contentful Paint) | DOMContentLoaded | Total Wall Clock |
| :--- | :---: | :---: | :---: | :---: |
| **Landing (`/`)** | **0.0062** | 1456 ms | 956 ms | 2110 ms |
| **Docs (`/getting-started/`)** | **0.0035** | 420 ms | 473 ms | 1178 ms |

*Note: CLS target for the new chrome is 0. Current landing is 0.0062, docs is 0.0035.*

## 2. Chrome JavaScript & CSS Sizes

### Client JavaScript (Gzip)
- **Header Script (`Header.astro`):** 2.71 kB (1.10 kB gzip)
- **Footer Script (`Footer.astro`):** 0.23 kB (0.18 kB gzip)
- **Theme Toggle Island (`ThemeToggle.tsx`):** 1.18 kB (0.61 kB gzip)
- **Total Chrome JS (Gzip):** **1.90 kB** *(Budget limit: 2.0 kB gzip)*

### Stylesheets (Source & Shared)
- **Buttons System (`buttons.css`):** 20.53 kB (3.40 kB gzip)
- **Docs Theme (`docs-theme.css`):** 19.34 kB (3.18 kB gzip)
- **Global Tokens & Theme (`global.css`):** 20.46 kB (4.38 kB gzip)

## 3. Visual Review Baseline
- **Captured Screenshots:** 50 screenshots spanning landing (top & scrolled), docs, 404, playground, across 1440, 1024, 768, 390px, light and dark modes, plus mobile drawer open, hover, and focus states.
- **Location:** `.shots/chrome/before/`
- **Contact Sheet:** `.shots/chrome/before/index.html`
