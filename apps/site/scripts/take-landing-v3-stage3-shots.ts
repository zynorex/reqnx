// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-landing-v3-stage3-shots.ts
//
// Captures review contact sheet of Stage 3 (HeroV3 + ArchitectureStage):
// - 1440 Desktop Hero & Stage (Dark & Light)
// - 1440 Desktop Architecture Stage Close-up (Dark & Light)
// - 390 Mobile Hero & Stage (Dark & Light)
// - Saves to .shots/landing-v3/stage3/ and copies to artifacts
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SHOTS_DIR = path.resolve(REPO_ROOT, '.shots/landing-v3/stage3');
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
}

const SHOTS: ShotSpec[] = [
  // Combined Hero & Architecture Stage Overview
  { name: 'stage3-hero-arch-1440-dark', width: 1440, height: 2400, theme: 'dark' },
  { name: 'stage3-hero-arch-1440-light', width: 1440, height: 2400, theme: 'light' },
  { name: 'stage3-hero-arch-390-dark', width: 390, height: 3200, theme: 'dark' },
  { name: 'stage3-hero-arch-390-light', width: 390, height: 3200, theme: 'light' },

  // Architecture Section Close-ups
  { name: 'stage3-arch-1440-dark', width: 1440, height: 1200, theme: 'dark', targetSelector: '#architecture' },
  { name: 'stage3-arch-1440-light', width: 1440, height: 1200, theme: 'light', targetSelector: '#architecture' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Navigate to dev styleguide where HeroV3 & ArchitectureStage are mounted
    await page.goto('http://localhost:4321/dev/styleguide/landing/', { waitUntil: 'networkidle' });

    // Set theme and disable motion for crisp rendering
    await page.evaluate((theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-motion', 'reduced');
      const header = document.querySelector('.styleguide-header');
      if (header instanceof HTMLElement) {
        header.style.display = 'none';
      }
      document.querySelector('astro-dev-toolbar')?.remove();
    }, shot.theme);

    // Wait for fonts & layout stabilization
    await page.waitForTimeout(600);

    const shotPath = path.join(SHOTS_DIR, `${shot.name}.png`);

    if (shot.targetSelector) {
      const el = page.locator(shot.targetSelector);
      await el.screenshot({ path: shotPath });
    } else {
      await page.screenshot({ path: shotPath, fullPage: false });
    }

    // Copy to artifacts dir
    const artifactPath = path.join(ARTIFACTS_DIR, `${shot.name}.png`);
    fs.copyFileSync(shotPath, artifactPath);

    console.log(`[shots] Captured ${shot.name}.png`);
    await context.close();
  }

  await browser.close();
  console.log('[shots] All Stage 3 screenshots captured and copied to artifacts!');
}

main().catch((err) => {
  console.error('[shots] Error capturing screenshots:', err);
  process.exit(1);
});
