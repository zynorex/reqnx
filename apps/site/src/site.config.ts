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

  /** Whether the package is published to npm. */
  published: false,

  /** Command to clone and run from source while unpublished. */
  fromSourceCmd: 'git clone https://github.com/zynorex/reqnx.git',
} as const;

/** Format an absolute path with the configured base URL. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
