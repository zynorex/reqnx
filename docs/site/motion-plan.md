# Landing Page: Motion and Effects Pass — Plan & Architecture

> Approved at Gate 1 on branch `landing-motion`. Serves as the authoritative resume specification.

---

## 1. Reference Study Summary

We analyzed the motion design and parameters of eight benchmark developer tools (Linear, Stripe, Vercel, Raycast, Cloudflare, Redis, Bun, and Astro).

| Parameter | Industry Standard | Reqnx Decision | Justification |
| :--- | :--- | :--- | :--- |
| **Micro-press** | 80–100 ms | 90 ms (`--rx-dur-instant`) | Immediate tactile response on `:active` and keyboard interaction. |
| **Hover In** | 120–160 ms | 140 ms (`--rx-dur-fast`) | Fast feedback without feeling abrupt. |
| **Hover Out** | 180–220 ms | 200 ms (`--rx-dur-base`) | Natural decay; prevents visual flicker on rapid pointer movement. |
| **Panels & Tabs** | 240–300 ms | 260 ms (`--rx-dur-panel`) | Smooth spatial sliding without delaying comprehension. |
| **Wipes & Sweeps** | 400–500 ms | 450 ms (`--rx-dur-wipe`) | Bounded clip-path theme wipe and button perimeter sweeps. |
| **Card Reveals** | 450–600 ms | 480 ms (`--rx-dur-reveal`) | Restrained entrance rise (12–16 px) when entering viewport. |
| **Hairline Draws** | 500–700 ms | 600 ms (`--rx-dur-hairline`) | Coordinate boundary line expansion. |
| **Hero Scan Sweep** | 800–1200 ms | 900 ms (`--rx-dur-hero`) | Grid scan band travels once across ticks; capped at 1.1 s total sequence. |
| **Page Transitions**| 150–200 ms | 180 ms (`--rx-dur-page`) | View-transition root crossfade. |
| **Spring Curve** | Small overshoot | CSS `linear()` ($\le 4\%$ overshoot) | Crisp deceleration with subtle physical settling. |

---

## 2. Browser Support Matrix & Fallbacks

- `animation-timeline: scroll(root)`: E3 scroll progress bar. Progressive enhancement. Kept `display: none` unless `@supports` passes.
- `animation-timeline: view()`: E14 card and divider reveals. Progressive enhancement. Falls back to single shared `IntersectionObserver` adding `.is-visible`.
- Same-Document View Transitions (`document.startViewTransition`): E4 circular clip-path theme wipe from toggle button. Falls back to synchronous theme swap (0ms).
- Cross-Document View Transitions (`@view-transition { navigation: auto }`): E26 root crossfade. Progressive enhancement; standard MPA navigation fallback.
- CSS `linear()` Easing Function: Micro-spring curve generated with $\le 4\%$ overshoot. Falls back to `--rx-ease-out` (`cubic-bezier(0.2, 0, 0, 1)`).
- `interpolate-size: allow-keywords` & `::details-content`: E21 FAQ height transition. Falls back to instant height with 160 ms opacity fade.
- `@property`: E7 button border sweep angle. Falls back to standard border brightening.
- `:has()` Selector: Supported universally across evergreen targets.
- `content-visibility: auto`: All sections maintain `contain-intrinsic-size: 1px 700px` to prevent layout shift during reveal.

---

## 3. Motion System & Token Specification

Tokens are layered under `@layer tokens` in `apps/site/src/styles/global.css`:

```css
/* Durations */
--rx-dur-instant: 90ms;      /* Button/tab press active feedback */
--rx-dur-fast: 140ms;         /* Hover in, card lift, arrow nudges */
--rx-dur-base: 200ms;         /* Hover out, icon crossfades, dismissals */
--rx-dur-panel: 260ms;        /* Tab panels, console algorithm switches */
--rx-dur-wipe: 450ms;         /* Theme clip-path wipe, button border sweep */
--rx-dur-reveal: 480ms;       /* Section card reveals, console frame rise */
--rx-dur-hairline: 600ms;     /* Coordinate ticks & border hairline draws */
--rx-dur-hero: 900ms;         /* E5 Scan band sweep across tick grid */
--rx-dur-page: 180ms;         /* E26 View-transition page crossfade */

/* Distances */
--rx-dist-xs: 4px;            /* Markers, micro nudges */
--rx-dist-sm: 8px;            /* Card lift, tab indicators */
--rx-dist-md: 12px;           /* Text reveals, console frame rise */
--rx-dist-lg: 16px;           /* Staggered card reveals, mascot arrival */
--rx-dist-xl: 24px;           /* Hard travel ceiling (CTA mascot slide) */

/* Easings */
--rx-ease-out: cubic-bezier(0.2, 0, 0, 1);
--rx-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--rx-ease-snap: cubic-bezier(0.25, 1, 0.5, 1);
--rx-ease-spring: linear(/* generated spring with <= 4% overshoot */);

/* Stagger Caps */
--rx-stagger-step: 40ms;
--rx-stagger-cap: 400ms;
```

---

## 4. Effects Catalog

| ID | Title | Priority | Decision | Description |
| :--- | :--- | :---: | :---: | :--- |
| **E1** | Header state | M | Build | Sentinel-driven surface and hairline fade-in (200 ms). Nav items never move. |
| **E2** | Nav indicator & scrollspy | M | Build | Sliding indicator tracks hover/focus; scrollspy via shared observer; smooth-scroll offset. |
| **E3** | Scroll progress | S | Build | 2px hairline under header driven by native `animation-timeline: scroll(root)`. |
| **E4** | Theme change | M/S | Build | M: icon rotate/scale (200 ms). S: circular clip-path wipe from toggle via View Transitions. |
| **E5** | Instrument boot | M | Build | **Signature 1**. 900 ms grid scan sweep, console rises 12px (480 ms), accent underline draws under "Deterministic". Total 1.1s. |
| **E6** | Grid backlight | S | Build | 240px pointer backlight in hero and footer tick row via shared rAF loop. |
| **E7** | Button micro-interactions | M/S | Modify | M: press scale 0.98 (90 ms), arrow nudge 3px (140 ms). S: `@property` border sweep (450 ms). (Magnetic X rejected). |
| **E8** | Command copy | M | Build | Icon stroke morph, "Copied" crossfade, 1.6s revert, live region announcement. |
| **E9** | Request markers | M | Build | **Signature 2**. Allowed marker pops (160 ms spring) with expanding ring; denied marker recoils (-4px to 0, 220 ms). |
| **E10** | Readouts | M/S | Build | M: digit columns roll (220 ms) with reserved widths and tint flash. S: depleting virtual retry ring. |
| **E11** | Window rollover | S | Build | Gauge segments clear left-to-right (scaleY, 40 ms stagger); boundary tick flashes (120 ms). |
| **E12** | Algorithm switch | M | Build | Tab indicator slides (240 ms); timeline wipes out/in (240 ms); loop restarts at t0. "Not yet" tabs nudge $\pm 2\text{ px}$. |
| **E13** | Break the store | X | Defer | Interactive failing store demo deferred to post-Gate 2. |
| **E14** | Reveal choreography | M | Build | Cards rise 16px (60 ms stagger, 400 ms cap); hairlines draw (600 ms). Once-only per element. |
| **E15** | Proof strip odometer | M | Build | Digits roll to exact values on view (30 ms stagger, 600 ms). Static HTML numbers preserved for SEO/a11y. |
| **E16** | Bento cards | M/S | Build | Lift 2px + border brighten (140 ms in, 200 ms out); hairline border tracking; SVG icon micro-animations. |
| **E17** | The seam | S | Build | Boundary flash (120 ms) on virtual window crossing; marker stagger (30 ms); badge rolls with spring. |
| **E18** | Algorithm tabs & matrix | M/S | Build | Indicator slide (220 ms); panel crossfade (120 ms/220 ms); matrix crosshair highlight on hover/focus (150 ms). |
| **E19** | Code callouts & outputs | S | Build | Callout hover highlights line (160 ms), dims others to 60%; output lines reveal in sequence (40 ms). |
| **E20** | Architecture packet | M/S | Build | Node hover highlights path; packet dot travels path (WAAPI), time-boxed to 5s then rests; recoil on denial. |
| **E21** | FAQ expansion | M | Build | Smooth open/close via `interpolate-size` / `::details-content` (220 ms); plus/minus morph (160 ms); hash highlight. |
| **E22** | Mascot reactions | M/S | Build | Arrival translateY 16px + rotate -2° (700 ms spring); hover tilt $\le 3^\circ$; 180 ms nod on console denial (max 1/2s). |
| **E23** | Status meter | S | Build | Progress bar fills (scaleX, 700 ms) on reveal; chip icons draw stroke-dashoffset (40 ms stagger). |
| **E24** | Chaos to order | S | Build | **Signature 3**. In final CTA, coordinate ticks start slightly scattered ($\le 12\text{ px}, 3^\circ$) and lock into grid (700 ms spring). |
| **E25** | Links & focus | M | Build | Underline draws scaleX on hover/focus (160 ms); external arrow nudges 2px; focus ring offset eases (120 ms). |
| **E26** | Page transitions | S | Build | Progressive enhancement: `@view-transition { navigation: auto }` with 180 ms crossfade. |
| **E27** | Motion control | M | Build | Footer control "Motion: System / Reduced"; persists to localStorage; sets `data-motion="reduced"`. |
| **E28** | Branded 404 motion | M | Build | Artwork enters (opacity + 12px, 480 ms); missing tick slot pulses twice (1.2s) then rests; suggestion links stagger (40 ms). |

---

## 5. Hero Choreography Timeline

- **Selected h1 Word**: **`"Deterministic"`** in `"Deterministic, distributed-ready rate limiting for TypeScript."`
- **Timeline Offsets**:
  - `t = 0 ms`: First Paint. All typography, CTAs, and code command are 100% visible and static. (CLS $= 0$).
  - `t = 50 ms`: Grid Scan Band sweeps left-to-right (900 ms).
  - `t = 150 ms`: Console Frame rises 12px and fades in (480 ms).
  - `t = 250 ms`: Mascot arrives beside console (700 ms spring).
  - `t = 300 ms`: Console Readouts roll to initial state (220 ms odometer roll).
  - `t = 600 ms`: Accent underline draws smoothly under `"Deterministic"` (500 ms).
  - `t = 1100 ms`: Hero sequence finishes and settles into live idle state.

---

## 6. Architecture & Kill-Switch Rules

1. **Kill Switch**: `<html data-motion="full | reduced">` initialized by an early inline `<head>` script reading `rx-motion` preference and `prefers-reduced-motion`.
2. **Reduced Motion Gating**:
   ```css
   @media (prefers-reduced-motion: no-preference) {
     html:not([data-motion="reduced"]) .target { ... }
   }
   ```
3. **No-JS Guarantees**: Elements are never hidden by default in static HTML. Hidden initial states exist strictly behind CSS `@supports (animation-timeline: ...)` or runtime JS classes.
4. **Dev Motion Lab**: Route at `/dev/motion` showcasing interactive playback controls, scrubbers, and toggles for every registered effect. Excluded from production sitemaps.

---

## 7. Performance & Quality Budgets

- Motion JS: $\le 6\text{ KB}$ gzip.
- Motion CSS: $\le 5\text{ KB}$ gzip.
- LCP delta: $\le +50\text{ ms}$ over baseline.
- CLS: $\le 0.02$ (Baseline is $0.0000$).
- TBT: $\le +20\text{ ms}$ (Baseline is $0\text{ ms}$).
- Animation concurrency: $\le 20$ running animations at any instant.
- CPU throttling: $p_{95}$ frame duration $\le 33\text{ ms}$ under 4x CPU slowdown.
