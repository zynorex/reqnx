import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import crypto from 'node:crypto';
import { brandAssets, mascotPlacements } from '../src/brand';

function getRepoRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(curr, 'brand/manifest.json'))) {
      return curr;
    }
    curr = resolve(curr, '..');
  }
  return process.cwd();
}

describe('Brand Asset System & Manifest Conformance', () => {
  const root = getRepoRoot();
  const manifestPath = join(root, 'brand/manifest.json');

  it('ensures brand/manifest.json exists and all recorded original checksums match', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    for (const [file, info] of Object.entries<any>(manifest)) {
      const origPath = join(root, 'brand', file);
      expect(existsSync(origPath)).toBe(true);

      const buf = readFileSync(origPath);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      expect(hash).toBe(info.checksum);
      expect(buf.length).toBe(info.byteSize);
    }
  });

  it('ensures brand descriptors define valid assets with explicit dimensions', () => {
    expect(brandAssets.logo.width).toBeGreaterThan(0);
    expect(brandAssets.logo.height).toBeGreaterThan(0);
    expect(brandAssets.mascot.width).toBeGreaterThan(0);
    expect(brandAssets.notFound.width).toBeGreaterThan(0);

    // Mascot and 404 art are decorative
    expect(brandAssets.mascot.alt).toBe('');
    expect(brandAssets.notFound.alt).toBe('');

    // Logo has descriptive accessible name
    expect(brandAssets.logo.alt).toBe('Reqnx home');
  });

  it('ensures mascot placements have defined loading and size attributes', () => {
    const placements = ['hero', 'section', 'cta', 'footer', '404'] as const;
    for (const p of placements) {
      const config = mascotPlacements[p];
      expect(config).toBeDefined();
      expect(config.width).toBeGreaterThan(0);
      expect(config.height).toBeGreaterThan(0);
      expect(config.sizes).toBeTruthy();
      expect(['lazy', 'eager']).toContain(config.loading);
    }

    // Only 404 is eager
    expect(mascotPlacements['404'].loading).toBe('eager');
    expect(mascotPlacements['hero'].loading).toBe('lazy');
  });

  it('ensures generated public favicons exist and are non-empty', () => {
    const publicFiles = [
      'favicon.ico',
      'favicon-16.png',
      'favicon-32.png',
      'favicon-48.png',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
      'site.webmanifest',
    ];

    for (const file of publicFiles) {
      const filePath = join(root, 'apps/site/public', file);
      expect(existsSync(filePath)).toBe(true);
      const stat = readFileSync(filePath);
      expect(stat.length).toBeGreaterThan(0);
    }
  });
});
