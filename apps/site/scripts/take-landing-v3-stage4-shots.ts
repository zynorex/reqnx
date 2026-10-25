// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-landing-v3-stage4-shots.ts
//
// Captures full review contact sheet of Landing v3:
// - 1440, 1024, 768, 390 full page (Dark & Warm Cream Light)
// - Section close-ups for S5 Tiers, S6 Benefits, S7 Status, S8 FAQ, S9 Closing
// - Saves to .shots/landing-v3/after/ and copies to artifacts
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SHOTS_DIR = path.resolve(REPO_ROOT, '.shots/landing-v3/after');
const ARTIFACTS_DIR = 'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

interface ShotSpec {
  name: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  targetSelector?: string;
  fullPage?: boolean;
}

const SHOTS: ShotSpec[] = [
  // Full Page Across All Breakpoints (Dark & Light)
  { name: 'landing-v3-1440-dark', width: 1440, height: 900, theme: 'dark', fullPage: true },
  { name: 'landing-v3-1440-light', width: 1440, height: 900, theme: 'light', fullPage: true },
  { name: 'landing-v3-1024-dark', width: 1024, height: 900, theme: 'dark', fullPage: true },
  { name: 'landing-v3-1024-light', width: 1024, height: 900, theme: 'light', fullPage: true },
  { name: 'landing-v3-768-dark', width: 768, height: 900, theme: 'dark', fullPage: true },
  { name: 'landing-v3-768-light', width: 768, height: 900, theme: 'light', fullPage: true },
  { name: 'landing-v3-390-dark', width: 390, height: 844, theme: 'dark', fullPage: true },
  { name: 'landing-v3-390-light', width: 390, height: 844, theme: 'light', fullPage: true },

  // Section Close-ups (1440)
  { name: 'landing-v3-hero-1440-dark', width: 1440, height: 1100, theme: 'dark', targetSelector: '#hero' },
  { name: 'landing-v3-hero-1440-light', width: 1440, height: 1100, theme: 'light', targetSelector: '#hero' },
  { name: 'landing-v3-arch-1440-dark', width: 1440, height: 1100, theme: 'dark', targetSelector: '#architecture' },
  { name: 'landing-v3-arch-1440-light', width: 1440, height: 1100, theme: 'light', targetSelector: '#architecture' },
  { name: 'landing-v3-proof-1440-dark', width: 1440, height: 800, theme: 'dark', targetSelector: '#proof' },
  { name: 'landing-v3-proof-1440-light', width: 1440, height: 800, theme: 'light', targetSelector: '#proof' },
  { name: 'landing-v3-contrast-1440-dark', width: 1440, height: 1000, theme: 'dark', targetSelector: '#contrast' },
  { name: 'landing-v3-contrast-1440-light', width: 1440, height: 1000, theme: 'light', targetSelector: '#contrast' },
  { name: 'landing-v3-tiers-1440-dark', width: 1440, height: 1000, theme: 'dark', targetSelector: '#algorithms' },
  { name: 'landing-v3-tiers-1440-light', width: 1440, height: 1000, theme: 'light', targetSelector: '#algorithms' },
  { name: 'landing-v3-resilience-1440-dark', width: 1440, height: 1000, theme: 'dark', targetSelector: '#resilience' },
  { name: 'landing-v3-resilience-1440-light', width: 1440, height: 1000, theme: 'light', targetSelector: '#resilience' },
  { name: 'landing-v3-status-1440-dark', width: 1440, height: 1000, theme: 'dark', targetSelector: '#status' },
  { name: 'landing-v3-status-1440-light', width: 1440, height: 1000, theme: 'light', targetSelector: '#status' },
  { name: 'landing-v3-faq-1440-dark', width: 1440, height: 900, theme: 'dark', targetSelector: '#faq' },
  { name: 'landing-v3-faq-1440-light', width: 1440, height: 900, theme: 'light', targetSelector: '#faq' },
  { name: 'landing-v3-closing-1440-dark', width: 1440, height: 800, theme: 'dark', targetSelector: '#closing' },
  { name: 'landing-v3-closing-1440-light', width: 1440, height: 800, theme: 'light', targetSelector: '#closing' },
];

async function getBaseUrl(): Promise<string> {
  for (const port of [4321, 4322, 4323]) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return `http://localhost:${port}/`;
    } catch {
      // try next
    }
  }
  return 'http://localhost:4321/';
}

async function main() {
  const baseUrl = await getBaseUrl();
  console.log(`[shots] Using dev server at ${baseUrl}`);
  const browser = await chromium.launch({ headless: true });

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Navigate to homepage
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Set theme and disable motion for crisp rendering
    await page.evaluate((theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-motion', 'reduced');
      document.querySelector('astro-dev-toolbar')?.remove();
    }, shot.theme);

    // Wait for fonts & layout stabilization
    await page.waitForTimeout(600);

    const shotPath = path.join(SHOTS_DIR, `${shot.name}.png`);

    if (shot.targetSelector) {
      const el = page.locator(shot.targetSelector);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await el.screenshot({ path: shotPath });
    } else {
      if (shot.fullPage) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(400);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: shotPath, fullPage: shot.fullPage ?? false });
    }

    // Copy to artifacts dir
    const artifactPath = path.join(ARTIFACTS_DIR, `${shot.name}.png`);
    fs.copyFileSync(shotPath, artifactPath);

    console.log(`[shots] Captured ${shot.name}.png`);
    await context.close();
  }

  await browser.close();
  console.log('[shots] All Landing v3 review screenshots captured successfully!');
}

main().catch((err) => {
  console.error('[shots] Error capturing screenshots:', err);
  process.exit(1);
});
