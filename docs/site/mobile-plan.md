# REQNX Flagship Mobile Experience — Architecture & Implementation Plan

> **Specification Reference:** Stage 1 Study & Plan (Gate 1 Approval Blueprint)  
> **Target Scope:** Landing page, Docs, Playground, 404, and Shared Chrome  
> **Target Devices:** Phones first (320px–767px), Tablets (768px–1023px) inherit sensibly, Desktop zero regression.

---

## 1. Executive Summary & Vibe Specification

The goal is to deliver an unmistakable flagship mobile experience: fast, tactile, calm, confident, and alive. 

### Measurable Proxies:
- **First Paint & Stability:** Status pill, H1, subhead, and 48px primary CTA visible and stable by first paint. Zero layout shift ($\text{CLS} \le 0.02$).
- **Touch Responsiveness:** Pointer-down feedback within one frame ($\le 90$ ms); tap on "Send request" returns decision within 150 ms; no 300 ms tap delay; double-tap zoom prevented without disabling pinch-zoom.
- **Scroll & Momentum:** Zero horizontal overflow from 320 px upwards; native scroll momentum and pull-to-refresh preserved without scroll-jacking.
- **Thumb Zone Reach:** Primary actions located in the lower 40% of the screen.
- **Safe Area Inset Respect:** Edges respect notch, home indicator, and rounded corners in portrait and landscape.
- **Calm Motion:** Respects `prefers-reduced-motion` and Lite Mode (Save-Data, low-end hardware).

---

## 2. Stage 0 Baseline Audit Summary

Audits conducted on throttled mid-tier profile (Chromium 360×800, 4× CPU slowdown, Slow 4G: 1.6 Mbps down, 750 kbps up, 150 ms RTT):

| Metric | Landing Page Baseline | Target Budget | Assessment |
|:---|:---|:---|:---|
| **JS Size (gzip)** | 3.2 KB (7.3 KB raw) | $\le 35$ KB initial, $\le 60$ KB total | ✅ Well within budget |
| **CSS Size (gzip)** | 20.9 KB (113.9 KB raw) | $\le 30$ KB | ✅ Within budget |
| **LCP (Throttled)** | 1908 ms | $\le 1800$ ms | ⚠️ Needs mobile ordering & svh tuning |
| **CLS** | 0.000 | $\le 0.02$ | ✅ Clean |
| **TBT (Throttled)** | 0 ms | $\le 100$ ms | ✅ Clean |
| **Horizontal Overflow (320–480px)** | 0 violations across all 5 pages | 0 allowed | ✅ Clean |
| **Tap-Target Audit (<44px)** | 78 violations (88.6% failure rate) | 0 violations | ⚠️ Validates need for 44px thumb dock & mobile reflow |

*58 BEFORE baseline screenshots archived under `.shots/mobile/before/` and conversation artifacts.*

---

## 3. Gate 1 Architectural Decisions

### Decision 1: Navigation Model
- **Selected: Option A (Thumb Dock + Slim Top Bar)** *(Recommended)*
- **Rationale:** Keeps primary destinations within one-thumb reach in the bottom 40% of the viewport. Top bar is reduced to 52px solid surface holding logo and quick theme toggle. If real-device tests fail, fallback is Option B (Top bar + floating button).

### Decision 2: Dock Contents
- **Selected:** 
  - Landing & Playground: `[Home, Docs, Search, Menu]`
  - Docs reading pages: `[Home, Contents, Search, Menu]`
- **Rationale:** On docs pages, slot 2 dynamically transitions to "Contents", allowing instant one-tap access to the section TOC bottom sheet without reaching to the top.

### Decision 3: Proof Band on Mobile
- **Selected: Scrolling Chip Rail in 2 rows** *(Recommended)*
- **Rationale:** User-controlled scroll snap container with edge fades. No battery-draining or distracting continuous autoplay animation.

### Decision 4: Tier Algorithm Cards
- **Selected: Native Scroll-Snap Rail with Peek** *(Recommended)*
- **Rationale:** Cards sized at 86% viewport width with a peek of the subsequent card, dot indicators, and 44px Previous/Next tap buttons (complying with WCAG 2.5.1 drag alternatives).

### Decision 5: Modal Sheets
- **Selected: Native Bottom Sheets with Snap Points** *(Recommended)*
- **Rationale:** Draggable bottom sheet with 44px hit-area handle, explicit Close button, half-height (~50vh) and full-height (88dvh) snap points.

### Decision 6: Haptics
- **Selected: Default-Off Progressive Enhancement** *(Recommended)*
- **Rationale:** Exposes a toggle in Preferences. Utilizes `navigator.vibrate` on supported Android Chromium browsers (10ms allowed pulse, double 15ms pulse denied). Gracefully no-ops on iOS Safari where WebKit does not expose the Vibration API.

### Decision 7: Code Blocks on Mobile
- **Selected: Full-Bleed with Edge Fades** *(Recommended)*
- **Rationale:** Breaks out to full screen width with 13px JetBrains Mono, horizontal scroll with momentum, and fixed 44px copy button.

### Decision 8: Landscape Phones (< 480px height)
- **Selected: Hide Dock below 480px height** *(Recommended)*
- **Rationale:** Maximizes precious vertical canvas; relies on compact top bar and menu sheet in landscape.

---

## 4. Implementation Stages (Stages 2–9)

### Stage 2: Foundations
1. **Server-rendered `<head>`:**
   - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
   - `<meta name="format-detection" content="telephone=no">`
   - Solid `theme-color` meta tags matching `--color-surface-base`.
2. **Safe-Area CSS Tokens:**
   - `--safe-top: env(safe-area-inset-top, 0px);`
   - `--safe-bottom: env(safe-area-inset-bottom, 0px);`
   - Enforce `svh` for hero heights, `dvh` for modal sheets. No `100vh` allowed.
3. **Touch Primitives & Pressed State:**
   - `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`.
   - Passive `pointerdown` listener applying `data-pressed` with 90ms budget.
4. **Layout Primitives:**
   - `Rail.astro`: native scroll-snap container with touch momentum and step buttons.
   - `Sheet.astro`: accessible dialog element with drag handle and focus trap.
   - `Dock.astro`: fixed 56px bottom thumb dock with 2px sliding indicator.
5. **State & Diagnostics:**
   - History helper (`pushState` / `popstate` for sheets).
   - `visualViewport` listener toggling keyboard mode.
   - `/dev/mobile-qa` diagnostics workbench and `/dev/styleguide/mobile`.

### Stage 3: Shared Chrome on Mobile
1. Top bar: 52px + `--safe-top`, solid background token (for iOS 26 tint stability), logo, version chip, theme toggle.
2. Bottom dock: 56px + `--safe-bottom`, 4 slots (64×56px targets), 2px sliding accent line.
3. Menu bottom sheet: drag handle, Close button, primary links (56px rows), algorithms accordion, preferences (theme, motion, haptics).
4. Search sheet: full-screen, 52px input (16px text), cancel button, instant results.
5. Contents sheet: docs TOC bottom sheet.
6. **GATE 2:** Multi-device screenshots, touch-tour video, real-device LAN QA verification.

### Stage 4: Landing Page Mobile Pass
1. Hero: Status pill $\to$ H1 $\to$ subhead $\to$ 48px primary CTA in lower 40% $\to$ command chip $\to$ simplified console stage.
2. Mobile Console: 130px timeline wave, 48px "Send request" & "Send burst" thumb pills, 2×2 readout grid.
3. Architecture: Full-width store toggle, vertical node diagram, stacked 56px stat cells.
4. Proof & Tiers: 2-row scrolling chip rail, 86% width tier cards rail with peek and dot indicators.
5. Race Contrast: Stacked snippets (13px mono), 52px "Send 1,000 at once" trigger pill, replay link.
6. Benefits & Terminal: Stacked benefit cards, 12px mono terminal with horizontal momentum scroller.
7. Closing Band: Stacked full-width CTA pills with brand mascot cameo.

### Stage 5: Documentation Experience
1. 17px/1.6 reading typography, 34–46 character measure.
2. Full-bleed code blocks with edge fades and sticky 44px copy button.
3. Reference tables reflow into stacked cards under 600px.
4. Dock slot switches to "Contents" for quick heading jumps.

### Stage 6: Playground, 404 & Secondary Pages
1. Playground: Full-bleed canvas timeline, thumb pills for Send One/Burst, Controls bottom sheet.
2. 404 Page: Reflowed vertical illustration, 48px recovery buttons in thumb zone.

### Stage 7: Feel & Polish
1. Micro-interactions: 90ms pressed state scale down (`scale(0.98)`).
2. Spring physics on sheet presentation (240ms).
3. Lite Mode activation for low-memory, slow connections, or reduced-motion preferences.
4. Optional Vibration API haptics for supported Android devices.

### Stage 8: Hardening & Quality Verification
1. Throttled mobile performance run (LCP $\le 1.8$s, CLS $\le 0.02$, TBT $\le 100$ms).
2. Accessibility audit (`@axe-core/playwright`) with zero serious/critical violations.
3. Tap-target audit asserting 100% of interactive elements meet $\ge 44\times 44$ px with $\ge 8$ px spacing.
4. Horizontal overflow validation across 320px–480px widths.
5. Cross-browser validation: Chromium mobile, WebKit mobile, Firefox mobile.

### Stage 9: Final Reporting
1. Before vs After screenshot matrix and contact sheets.
2. Touch-tour recorded walkthroughs.
3. Updated ADRs and CLAUDE.md guidelines.
