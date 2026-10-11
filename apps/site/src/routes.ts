// ──────────────────────────────────────────────────────────────────────────────
// apps/site — Route Manifest & Dynamic Link Resolver
//
// Typed manifest of site routes verified against build output.
// resolveLink(target) ensures landing pages never emit 404 links:
// if a site page exists, returns internal base-aware URL;
// otherwise resolves to the matching repository file on GitHub as external.
// ──────────────────────────────────────────────────────────────────────────────

import { siteConfig, withBase } from './site.config';

export interface SiteRoute {
  readonly path: string;
  readonly title: string;
}

export const siteRoutes: readonly SiteRoute[] = [
  { path: '/', title: 'Home' },
  { path: '/getting-started/', title: 'Getting Started' },
  { path: '/algorithms/', title: 'Algorithms' },
  { path: '/algorithms/fixed-window/', title: 'Fixed Window Counter' },
  { path: '/playground/', title: 'Playground' },
  { path: '/404/', title: 'Page Not Found' },
] as const;

export interface ResolvedLink {
  readonly href: string;
  readonly isExternal: boolean;
  readonly externalNotice?: string;
}

/** Check whether a site route exists in the manifest. */
export function routeExists(path: string): boolean {
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return siteRoutes.some((r) => r.path === normalized || r.path === path);
}

/**
 * Resolve an internal or repository target to a working URL.
 *
 * @param target - Site route ('/getting-started/'), anchor ('#status'), or repo path ('docs/adr/0001.md')
 */
export function resolveLink(target: string): ResolvedLink {
  // Anchors
  if (target.startsWith('#')) {
    return { href: target, isExternal: false };
  }

  // Absolute external URLs
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return {
      href: target,
      isExternal: true,
      externalNotice: '(opens in a new tab)',
    };
  }

  // Internal site routes
  if (target.startsWith('/')) {
    const normalized = target.endsWith('/') ? target : `${target}/`;
    if (siteRoutes.some((r) => r.path === normalized || r.path === target)) {
      return {
        href: withBase(target),
        isExternal: false,
      };
    }

    // Site page not yet generated; fallback to matching repo doc if available
    const repoRelative = target.replace(/^\//, '').replace(/\/$/, '') + '.md';
    return {
      href: `${siteConfig.repo}/blob/main/docs/${repoRelative}`,
      isExternal: true,
      externalNotice: '(opens in a new tab)',
    };
  }

  // Repo file paths (e.g. packages/core/src/..., docs/adr/...)
  return {
    href: `${siteConfig.repo}/blob/main/${target}`,
    isExternal: true,
    externalNotice: '(opens in a new tab)',
  };
}
