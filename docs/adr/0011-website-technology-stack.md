# ADR-0011: Website Technology Stack

## Status

Accepted

## Context

Day 3B introduces the foundation for a public documentation and demonstration website for REQNX (`apps/site`). The website serves two purposes:

1. Deliver comprehensive, accessible documentation and guides for developers.
2. Provide interactive, live demonstrations where visitors can run real rate limiting scenarios directly in their browser.

We needed to select a technology stack meeting the following requirements:

- Static-first documentation engine with optimal SEO, accessibility, and zero-JS default for text/docs content.
- Support for interactive components ("islands") without hydrating the entire page.
- Direct consumption of `@reqnx/core` via workspace linkage.
- Minimal build complexity and fast local iteration.

## Decisions

### 1. Astro + Starlight for static documentation

We select **Astro** with the official **Starlight** documentation theme for `apps/site`:

- **Content Collections & Markdown**: Built-in support for MDX, code highlighting, tables, alerts, and sidebar navigation.
- **Zero JS by default**: All docs, landing typography, and layout styles are pre-rendered as pure HTML/CSS.
- **Blueprint visual identity**: Custom CSS system layered over Starlight variables to deliver the dark navy/indigo engineering blueprint visual aesthetic.

### 2. Preact for interactive islands

For interactive components (the playground, scenario player, request timeline, capacity gauge, copy button):

- **Preact** via `@astrojs/preact`.
- **Bundle size**: Preact provides the React component model and hooks (`useState`, `useCallback`, `useRef`) with ~4KB runtime footprint compared to React's ~40KB+.
- **Island architecture**: Interactive widgets are isolated using `client:load` or `client:visible` directives, ensuring only demo components load JavaScript in the visitor's browser.

### 3. Math rendering

Algorithm documentation uses LaTeX math expressions ($\lfloor \dots \rfloor$). Mathematical typography is rendered at build-time or via lightweight formatting to preserve clarity without blocking page loads.

## Consequences

- Documentation pages load instantly with near-perfect Lighthouse performance scores.
- Interactive rate limiting demos run in isolated Preact islands without pulling in large framework runtimes.
- `@reqnx/site` is a private workspace package (`"private": true`) excluded from npm publication checks.
