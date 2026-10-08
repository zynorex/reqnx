import { describe, it, expect } from 'vitest';
import { siteRoutes, routeExists, resolveLink } from '../src/routes';

describe('Route Manifest & Dynamic Link Resolver', () => {
  it('contains essential site routes including home, playground, and 404', () => {
    const paths = siteRoutes.map((r) => r.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/playground/');
    expect(paths).toContain('/getting-started/');
    expect(paths).toContain('/algorithms/');
    expect(paths).toContain('/404/');
  });

  it('correctly resolves existing internal routes without external flags', () => {
    const home = resolveLink('/');
    expect(home.isExternal).toBe(false);
    expect(home.href).toBe('/');

    const playground = resolveLink('/playground/');
    expect(playground.isExternal).toBe(false);
    expect(playground.href).toBe('/playground/');
  });

  it('correctly resolves hash anchors internally', () => {
    const status = resolveLink('#status');
    expect(status.isExternal).toBe(false);
    expect(status.href).toBe('#status');
  });

  it('resolves repo docs as external GitHub links for pages not yet in site', () => {
    const adr = resolveLink('docs/adr/0001-package-boundaries.md');
    expect(adr.isExternal).toBe(true);
    expect(adr.href).toContain('https://github.com/zynorex/reqnx/blob/main/docs/adr/');
    expect(adr.externalNotice).toBe('(opens in a new tab)');
  });
});
