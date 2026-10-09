# ADR 0015: Landing Page Architecture & Art Direction

## Status

Accepted

## Context

Reqnx requires a developer-facing landing page at `/` to explain what the library is, build developer trust, and demonstrate its atomic rate limiting mechanics directly in the browser. Infrastructure tools (Redis, Cloudflare, Envoy) earn trust through technical precision rather than decorative marketing hype. The page must balance an interactive browser instrument with strict performance budgets and accessibility standards.

## Decision

1. **Art Direction: "The Instrument"**:
   - Palette anchors to dark charcoal canvas (`#0f1117`), electric cyan accents (`#14ddfd`), and amber gold tokens (`#fcb020`), with light theme variations providing $\ge 4.5:1$ contrast (e.g., cyan-teal `#0369a1`).
   - "Window Tick" motif: A repeating 1px hairline coordinate grid with 40px minor and 200px major boundary ticks representing epoch time windows.
   - Restrained Mascot Placement: The brand mascot acts strictly as a friendly co-pilot outside data surfaces (in the hero stage, open source badge, and final CTA). The mascot never appears inside algorithmic data displays, logs, or recipes.

2. **Island Architecture**:
   - Built with Astro 5 and Preact islands.
   - Interactive elements (`LiveConsole`, `ThemeToggle`, `CopyButton`) load via `client:idle` or `client:load`.
   - All critical hero typography and headings render as static HTML to guarantee immediate Largest Contentful Paint (LCP) with zero layout shift.

3. **Performance & CSS Layers**:
   - Layered CSS structure (`@layer reset, tokens, base, layout, components, utilities`) prevents specificity wars.
   - Off-screen sections employ `content-visibility: auto` with intrinsic size estimates (`contain-intrinsic-size: 1px 700px`) to minimize layout costs.
   - Total landing client JS gzip is constrained to $\le 35\text{ KB}$ for the core instrument.

## Consequences

- The page renders with near-instant static speed and zero CLS.
- Developers can interact with the real `@reqnx/core` library executing on a simulated clock without downloading hefty external assets or analytics.
