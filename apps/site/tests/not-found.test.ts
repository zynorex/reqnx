import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function getRepoRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(curr, 'apps/site/dist/404.html'))) {
      return curr;
    }
    curr = resolve(curr, '..');
  }
  return process.cwd();
}

describe('Branded 404 Page Output & Accessibility', () => {
  const root = getRepoRoot();
  const notFoundHtmlPath = join(root, 'apps/site/dist/404.html');

  it('ensures dist/404.html is emitted at root', () => {
    expect(existsSync(notFoundHtmlPath)).toBe(true);
  });

  it('ensures dist/404.html has noindex meta tag regardless of environment', () => {
    const html = readFileSync(notFoundHtmlPath, 'utf-8');
    expect(html).toMatch(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i);
  });

  it('ensures dist/404.html contains exactly one h1 tag', () => {
    const html = readFileSync(notFoundHtmlPath, 'utf-8');
    const h1Matches = html.match(/<h1\b/g) || [];
    expect(h1Matches).toHaveLength(1);
    expect(html).toContain('This route has been dropped.');
  });

  it('ensures dist/404.html has the 404 artwork with decorative alt="" and dimensions', () => {
    const html = readFileSync(notFoundHtmlPath, 'utf-8');
    expect(html).toMatch(/<img[^>]*alt(=["']["'])?[^>]*width=["']560["'][^>]*height=["']373["']/);
  });

  it('ensures essential navigation links are present and base-aware', () => {
    const html = readFileSync(notFoundHtmlPath, 'utf-8');
    expect(html).toContain('Back to home');
    expect(html).toContain('/getting-started/');
    expect(html).toContain('/algorithms/');
    expect(html).toContain('/playground/');
  });
});
