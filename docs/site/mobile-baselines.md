# Mobile Experience — Stage 0 Baseline Measurements

> Recorded on: `2026-10-27T15:25:42.274Z`
> Profile: Throttled mid-tier Android (Chromium 360x800, 4x CPU slowdown, Slow 4G network: 1.6 Mbps down, 750 kbps up, 150 ms RTT)

---

## 1. Asset Sizes per Page Type

| Page | HTML Raw / Gzip | JS Raw / Gzip | CSS Raw / Gzip | Total Gzip |
|:-----|:----------------|:--------------|:---------------|:-----------|
| `/` | 123.8 KB / **23.1 KB** | 7.3 KB / **3.2 KB** (5 scripts) | 113.9 KB / **20.9 KB** (5 sheets) | **47.2 KB** |
| `/getting-started/` | 77.5 KB / **15.8 KB** | 12.4 KB / **5.6 KB** (6 scripts) | 140.6 KB / **26.6 KB** (5 sheets) | **48.0 KB** |
| `/design/architecture/` | 74.7 KB / **15.2 KB** | 12.4 KB / **5.6 KB** (6 scripts) | 140.6 KB / **26.6 KB** (5 sheets) | **47.4 KB** |
| `/playground/` | 59.5 KB / **14.2 KB** | 9.9 KB / **4.5 KB** (5 scripts) | 122.8 KB / **22.8 KB** (4 sheets) | **41.5 KB** |
| `/404/` | 0.0 KB / **0.0 KB** | 0.0 KB / **0.0 KB** (0 scripts) | 0.0 KB / **0.0 KB** (0 sheets) | **0.0 KB** |

- **Budget target for landing:** Initial JS gzip $\le 35$ KB, all landing JS $\le 60$ KB, CSS $\le 30$ KB.
- Current landing JS gzip: **3.2 KB**, CSS gzip: **20.9 KB**.

---

## 2. Throttled Core Web Vitals (360x800, 4x CPU, Slow 4G)

| Page | LCP (Target $\le 1.8$s) | FCP | CLS (Target $\le 0.02$) | TBT (Target $\le 100$ms) | Send Request Latency (Target $\le 150$ms) |
|:-----|:------------------------|:----|:------------------------|:-------------------------|:-------------------------------------------|
| `/` | **1908 ms** | 1360 ms | **0** | **0 ms** (0 long tasks) | **2950 ms** |
| `/getting-started/` | **1716 ms** | 1512 ms | **0.042** | **39 ms** (1 long tasks) | N/A |
| `/playground/` | **1724 ms** | 1424 ms | **0.0032** | **42 ms** (3 long tasks) | **164 ms** |

---

## 3. Tap-Target & Touch Geometry Audit (390x844)

Minimum target size rule: $\ge 44\times 44$ px, minimum spacing $\ge 8$ px.

| Page | Total Interactive Targets | Violations (< 44px or < 8px spacing) | Violation Rate |
|:-----|:--------------------------|:------------------------------------|:---------------|
| `/` | 88 | **78** | **88.6%** |
| `/getting-started/` | 42 | **39** | **92.9%** |
| `/design/architecture/` | 36 | **34** | **94.4%** |
| `/playground/` | 35 | **34** | **97.1%** |
| `/404/` | 19 | **19** | **100.0%** |

### Notable Tap-Target Issues to Address in Flagship Mobile Redesign:
- **/**: `<a class="rx-skip-link astro-fsdfqqju">` ("Skip to main content") measures **160×37px** (needs 44×44px)
- **/**: `<a class="rx-brand-logo astro-fsdfqqju a">` ("REQN X") measures **97×32px** (needs 44×44px)
- **/**: `<button class="rx-theme-toggle">` ("◐system") measures **80×36px** (needs 44×44px)
- **/getting-started/**: `<a class="astro-kzjdult4">` ("Skip to content") measures **114×28px** (needs 44×44px)
- **/getting-started/**: `<a class="rx-skip-link astro-fsdfqqju">` ("Skip to main content") measures **160×39px** (needs 44×44px)
- **/getting-started/**: `<a class="rx-brand-logo astro-fsdfqqju a">` ("REQN X") measures **95×33px** (needs 44×44px)
- **/design/architecture/**: `<a class="astro-kzjdult4">` ("Skip to content") measures **114×28px** (needs 44×44px)
- **/design/architecture/**: `<a class="rx-skip-link astro-fsdfqqju">` ("Skip to main content") measures **160×39px** (needs 44×44px)
- **/design/architecture/**: `<a class="rx-brand-logo astro-fsdfqqju a">` ("REQN X") measures **95×33px** (needs 44×44px)
- **/playground/**: `<a class="astro-kzjdult4">` ("Skip to content") measures **114×28px** (needs 44×44px)
- **/playground/**: `<a class="rx-skip-link astro-fsdfqqju">` ("Skip to main content") measures **160×39px** (needs 44×44px)
- **/playground/**: `<a class="rx-brand-logo astro-fsdfqqju a">` ("REQN X") measures **95×33px** (needs 44×44px)
- **/404/**: `<a class="rx-skip-link astro-fsdfqqju">` ("Skip to main content") measures **160×37px** (needs 44×44px)
- **/404/**: `<a class="rx-brand-logo astro-fsdfqqju a">` ("REQN X") measures **97×32px** (needs 44×44px)
- **/404/**: `<button class="rx-theme-toggle">` ("◐system") measures **80×36px** (needs 44×44px)

---

## 4. Horizontal Overflow Audit (320px to 480px)

Rule: document.documentElement.scrollWidth <= window.innerWidth across all phone widths.

| Page | 320px | 360px | 375px | 384px | 390px | 393px | 414px | 430px | 480px |
|:-----|:------|:------|:------|:------|:------|:------|:------|:------|:------|
| `/` | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK |
| `/getting-started/` | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK |
| `/design/architecture/` | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK |
| `/playground/` | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK |
| `/404/` | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK | ✅ OK |


