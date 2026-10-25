# Chrome UI Research Parameters Table

Verified across 6 developer infrastructure references (Tailwind CSS, Cloudflare Docs, Vercel, Resend, Redis, Stripe) at 1440x900 and 390x844.

## 1. Reference Site Measurements

| Site | Desktop Header H | Mobile Header H | Nav Item Size / Gap | Search Trigger (Desktop) | Footer Columns | Footer Link H / Size | Border Alpha |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tailwind CSS** | 64 px | 56 px | 14px / 24px gap | 240 × 36 px | 4 cols | 32 px / 14px | ~0.08 |
| **Cloudflare Docs** | 56 px | 52 px | 14px / 20px gap | 280 × 36 px | 5 cols | 34 px / 14px | ~0.10 |
| **Vercel** | 56 px | 52 px | 14px / 20px gap | 240 × 32 px | 5 cols | 32 px / 14px | ~0.08 |
| **Resend** | 56 px | 52 px | 14px / 18px gap | 260 × 34 px | 4 cols | 32 px / 14px | ~0.07 |
| **Redis** | 64 px | 56 px | 14px / 24px gap | 240 × 36 px | 5 cols | 36 px / 14px | ~0.12 |
| **Stripe Docs** | 56 px | 54 px | 14px / 24px gap | 280 × 36 px | 4 cols | 34 px / 14px | ~0.08 |

---

## 2. Parameter Synthesis vs Initial Targets

| Dimension | Initial Spec Target | Industry Consensus | REQNX Decision | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Header Height (Desktop)** | 56 px (down from 64 px) | 56 px (4 of 6 sites) | **56 px** (`--header-height: 56px`) | 56 px is the modern sweet spot for developer tooling: leaves maximum vertical viewport for reading code and documentation without cramping 36px controls. |
| **Header Height (Mobile)** | 52 px (< 768 px) | 52 – 54 px | **52 px** (`390px` viewport) | Maximizes reading stage on mobile while preserving 44 px touch targets for logo and menu trigger. |
| **Nav Typography & Gap** | 14/500, 12px inline padding | 14px / 18–24px gap | **14px / 500 wt, 20px gap** | Uncluttered, quiet hierarchy. Secondary text (`--rx-text-2`) brightening to primary (`--rx-text-1`) on hover/active. |
| **Search Trigger (Docs Desktop)** | 36 px tall, 240–320 px wide | 34–36 px tall, 240–280 px wide | **36 px tall, 240–280 px wide** | Fits standard 36px control grid; accommodates search icon, "Search docs" placeholder, and fixed-width platform `kbd` chip (`Ctrl K` / `⌘ K`). |
| **Current Location Marker** | 2 px accent underline flush with border | Accent underline or pill | **2 px underline flush with bottom border** | Maintains "The Instrument" blueprint aesthetic. Avoids bulky pills that disrupt the reading baseline. |
| **Footer Structure (Full)** | 3–5 columns, minimal | 4–5 columns | **4 columns (Brand 5 cols, 3 link cols of 2 cols, Preferences/Legal)** | Balanced 12-column layout. Avoids 40-link link farms while providing direct access to Project, Learn, and Source. |
| **Footer Link Row Height** | 32 px desktop, 44 px mobile | 32–34 px desktop | **32 px desktop, 44 px mobile touch** | Optimal density for desktop scanning; meets WCAG 2.5.5 / 2.5.8 touch target requirements on mobile. |
| **Border Alpha / Hairline** | 0.08 alpha | 0.07 – 0.10 alpha | **0.08 dark (`rgba(255,255,255,0.08)`), 0.08 light (`rgba(15,23,42,0.08)`)** | Crisp hairline borders without visual distraction. |

---

## 3. Recommendations on Open Decisions for Gate 1

1. **Header height:** **56 px** (52 px on mobile < 768 px). Changes landing's old 64 px to 56 px.
2. **Header surface when solid:** **92% opaque with 12 px blur** (`color-mix(in srgb, var(--rx-surface-1) 92%, transparent)`). Provides seamless immersion with proven worst-case contrast against tick motifs and high-contrast backdrops.
3. **Current-location marker:** **2 px accent underline flush with the bottom border** (`var(--rx-accent-cyan)`). Slides with 240 ms spring transition; instant on reduced motion.
4. **Algorithms flyout on marketing header:** **Include as hybrid disclosure pattern** (link to `/algorithms/` plus disclosure chevron button with `aria-expanded`, 320 px panel with available algorithms first).
5. **Theme control on desktop:** **Three-option SegmentedControl** (System, Light, Dark with 16px laptop, sun, moon icons; 28px items in 32px pill). Radiogroup semantics; writes to shared preference store.
6. **Footer surface:** **Sunken surface (`--rx-surface-1` with top hairline)**; **Ruler top edge ON** (12 px subtle tick strip with 8px interval, faded masks at ends, off under forced colors).
7. **Docs area navigation below 1280 px:** **"Section" disclosure dropdown** (shows current section label with chevron; opens compact list of 6 docs areas; below 1024 px moves into the sheet).
