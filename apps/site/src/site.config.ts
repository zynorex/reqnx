// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Centralised site metadata
//
// Single source of truth for project name, URLs, and descriptive text.
// Imported by layouts, components, and meta tags.
// ──────────────────────────────────────────────────────────────────────────────

export const siteConfig = {
  /** Project name. */
  name: 'REQNX',

  /** One-line tagline (no hype). */
  tagline: 'Predictable rate limiting for Node.js',

  /** Current version. */
  version: '0.x',

  /** GitHub repository URL. */
  repo: 'https://github.com/zynorex/reqnx',

  /** npm package name. */
  packageName: '@reqnx/core',

  /** npm install command. */
  installCmd: 'npm install @reqnx/core',

  /** Short description for meta tags. */
  description:
    'A pluggable, distributed-ready rate limiter library for Node.js. Five algorithms, two stores, zero core dependencies. Written in TypeScript.',

  /** License. */
  license: 'MIT',
} as const;
