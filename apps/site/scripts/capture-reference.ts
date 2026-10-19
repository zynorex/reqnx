// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/capture-reference.ts
//
// Stage 1 Live Capture of Reference Site (cloudflare.com):
// - Viewports: 1440x900, 1280x800, 768x1024, 390x844
// - Human-speed scroll, single load per viewport, no crawling, no asset downloads
// - Measures computed styles, heights, paddings, fonts, marquee parameters
// - Saves private screenshots to .shots/reference/ (strictly gitignored)
// - If blocked or challenged, exits gracefully with fallback flag
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../..');
const REF_DIR = path.resolve(REPO_ROOT, '.shots/reference');
const DATA_FILE = path.resolve(REPO_ROOT, 'docs/site/reference-capture-data.json');

if (!fs.existsSync(REF_DIR)) {
  fs.mkdirSync(REF_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'ref-1440x900', width: 1440, height: 900 },
  { name: 'ref-1280x800', width: 1280, height: 800 },
  { name: 'ref-768x1024', width: 768, height: 1024 },
  { name: 'ref-390x844', width: 390, height: 844 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const captureData: any = {
    timestamp: new Date().toISOString(),
    status: 'success',
    measurements: {},
  };

  try {
    for (const vp of VIEWPORTS) {
      console.log(`Loading reference site at ${vp.width}x${vp.height}...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      try {
        const response = await page.goto('https://www.cloudflare.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        // Check for challenge
        const pageTitle = await page.title();
        const content = await page.content();
        if (
          pageTitle.includes('Attention Required') ||
          pageTitle.includes('Just a moment') ||
          content.includes('cf-turnstile') ||
          content.includes('challenge-platform')
        ) {
          console.warn(`[!] Cloudflare served a verification challenge at ${vp.width}. Halting live capture.`);
          captureData.status = 'challenged';
          break;
        }

        // Wait a bit for fonts and layout
        await page.waitForTimeout(2000);

        // Smooth human-speed scroll
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                window.scrollTo(0, 0);
                resolve();
              }
            }, 100);
          });
        });

        await page.waitForTimeout(1000);

        // Capture screenshot
        const shotPath = path.join(REF_DIR, `${vp.name}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`Saved screenshot to ${shotPath}`);

        // Collect structural parameters if 1440
        if (vp.width === 1440) {
          const params = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const h1Style = h1 ? window.getComputedStyle(h1) : null;

            const h2 = document.querySelector('h2');
            const h2Style = h2 ? window.getComputedStyle(h2) : null;

            const bodyStyle = window.getComputedStyle(document.body);
            const header = document.querySelector('header');
            const headerStyle = header ? window.getComputedStyle(header) : null;

            // Fonts
            const fonts: string[] = [];
            document.fonts.forEach((f) => fonts.push(`${f.family} (${f.weight})`));

            return {
              title: document.title,
              h1: h1Style
                ? {
                    fontSize: h1Style.fontSize,
                    fontWeight: h1Style.fontWeight,
                    lineHeight: h1Style.lineHeight,
                    letterSpacing: h1Style.letterSpacing,
                    color: h1Style.color,
                  }
                : null,
              h2: h2Style
                ? {
                    fontSize: h2Style.fontSize,
                    fontWeight: h2Style.fontWeight,
                    lineHeight: h2Style.lineHeight,
                    color: h2Style.color,
                  }
                : null,
              header: headerStyle
                ? {
                    height: headerStyle.height,
                    backgroundColor: headerStyle.backgroundColor,
                  }
                : null,
              body: bodyStyle
                ? {
                    backgroundColor: bodyStyle.backgroundColor,
                    color: bodyStyle.color,
                    fontFamily: bodyStyle.fontFamily,
                  }
                : null,
              fonts: Array.from(new Set(fonts)),
            };
          });

          captureData.measurements = params;
        }
      } catch (err: any) {
        console.warn(`[!] Error loading ${vp.width}x${vp.height}:`, err.message);
        captureData.status = 'error';
        break;
      } finally {
        await context.close();
      }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(captureData, null, 2));
    console.log(`Reference capture data written to ${DATA_FILE}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
