// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/data/chrome.ts
//
// Single authoritative typed data source for REQNX site chrome:
// Navigation items, docs area tabs, algorithms flyout, footer link groups,
// and legal/licensing metadata.
// ──────────────────────────────────────────────────────────────────────────────

import { siteConfig, withBase } from '../site.config';
import { algorithms, getAvailableAlgorithms } from '../features';
import { resolveLink } from '../routes';

export interface ChromeNavItem {
  readonly label: string;
  readonly href: string;
  readonly isExternal?: boolean;
}

export interface ChromeFlyoutAlgorithm {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: 'available' | 'coming-soon';
  readonly href: string;
}

export interface ChromeAreaTab {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface ChromeFooterGroup {
  readonly heading: string;
  readonly links: readonly ChromeNavItem[];
}

export interface ChromeData {
  readonly brand: {
    readonly name: string;
    readonly tagline: string;
    readonly version: string;
    readonly repo: string;
  };
  readonly marketingNav: readonly ChromeNavItem[];
  readonly flyoutAlgorithms: readonly ChromeFlyoutAlgorithm[];
  readonly docsAreas: readonly ChromeAreaTab[];
  readonly footerGroups: readonly ChromeFooterGroup[];
  readonly legal: {
    readonly licenseNotice: string;
    readonly trademarkNotice: string;
    readonly privacyNotice: string;
  };
}

export const chromeData: ChromeData = {
  brand: {
    name: siteConfig.name,
    tagline: siteConfig.tagline,
    version: siteConfig.version,
    repo: siteConfig.repo,
  },

  marketingNav: [
    { label: 'Docs', href: withBase('/getting-started/') },
    { label: 'Algorithms', href: withBase('/algorithms/') },
    { label: 'Playground', href: withBase('/playground/') },
    { label: 'Status', href: '#status' },
  ],

  flyoutAlgorithms: [
    // Available algorithms first
    ...algorithms
      .filter((a) => a.status === 'available')
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        status: a.status,
        href: withBase(`/algorithms/${a.slug}/`),
      })),
    // Coming soon algorithms next
    ...algorithms
      .filter((a) => a.status !== 'available')
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        status: a.status,
        href: withBase('/algorithms/'),
      })),
  ],

  docsAreas: [
    { id: 'start', label: 'Start', href: withBase('/getting-started/') },
    { id: 'algorithms', label: 'Algorithms', href: withBase('/algorithms/') },
    { id: 'architecture', label: 'Architecture', href: withBase('/design/architecture/') },
    { id: 'adr', label: 'Decisions', href: withBase('/design/adr/0001-package-boundaries/') },
    { id: 'playground', label: 'Playground', href: withBase('/playground/') },
  ],

  footerGroups: [
    {
      heading: 'Project',
      links: [
        { label: 'Docs', href: withBase('/getting-started/') },
        { label: 'Algorithms', href: withBase('/algorithms/') },
        { label: 'Playground', href: withBase('/playground/') },
        { label: 'Status', href: resolveLink('#status').href },
      ],
    },
    {
      heading: 'Learn',
      links: [
        { label: 'Quickstart', href: withBase('/getting-started/') },
        { label: 'Fixed Window', href: withBase('/algorithms/fixed-window/') },
        { label: 'Token Bucket', href: withBase('/algorithms/token-bucket/') },
        { label: 'Architecture', href: withBase('/design/architecture/') },
        { label: 'Baseline Benchmarks', href: withBase('/design/benchmarks/day-04/') },
      ],
    },
    {
      heading: 'Source',
      links: [
        { label: 'GitHub', href: siteConfig.repo, isExternal: true },
        { label: 'Issues', href: `${siteConfig.repo}/issues`, isExternal: true },
        { label: 'Contributing', href: `${siteConfig.repo}/blob/main/CONTRIBUTING.md`, isExternal: true },
        { label: 'Changelog', href: `${siteConfig.repo}/blob/main/CHANGELOG.md`, isExternal: true },
        { label: 'MIT License', href: `${siteConfig.repo}/blob/main/LICENSE`, isExternal: true },
      ],
    },
  ],

  legal: {
    licenseNotice:
      'Software licensed under MIT. Reqnx logo, mascot, and character illustrations are copyright the project maintainers.',
    trademarkNotice:
      'Redis is a registered trademark of Redis Ltd. Express and Fastify are trademarks of their respective owners. REQNX has no official affiliation with these projects.',
    privacyNotice: 'No cookies. No tracking.',
  },
};
