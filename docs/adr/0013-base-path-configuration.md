# ADR-0013: Base-Path Configuration and SEO Guardrails

## Status

Accepted

## Context

`apps/site` needs to support both local development at root path (`http://localhost:4321/`) and potential hosting on GitHub Pages under a repository sub-path (e.g. `https://zynorex.github.io/reqnx/`) or root custom domains.

Additionally, while the website is being developed during Days 3-9, search engine crawlers should not index partial documentation or draft pages before the library's initial public release on Day 10.

## Decisions

### 1. Dynamic base-path via `BASE_PATH`

`astro.config.mjs` configures the Astro site and base paths dynamically:

```javascript
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: 'https://zynorex.github.io',
  base,
  // ...
});
```

- Local development defaults to `/`.
- CI builds targeting GitHub Pages can pass `BASE_PATH=/reqnx/` seamlessly.
- Internal navigation links use Astro's path resolution to remain valid regardless of base path prefix.

### 2. Robots noindex directive until Day 10

During the initial development phase:

- `public/robots.txt` disallows all user agents (`Disallow: /`).
- Starlight head configuration injects `<meta name="robots" content="noindex, nofollow">` across all documentation and landing pages.
- On Day 10 (Public Release), the robots directives will be updated to allow indexing and sitemap generation.

## Consequences

- Site builds remain portable across local environments, branch previews, and GitHub Pages.
- Search indexing is safely suppressed until the full 10-day build is complete and stable.
