// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-chrome-before-shots.ts
//
// Stage 0: Capture BEFORE screenshots of the header and footer in every context:
// - landing top and scrolled
// - docs (/getting-started/)
// - 404 (/404/)
// - playground (/playground/)
// at 1440, 1024, 768, and 390, light and dark, plus menu-open, hover and focus states.
// Saves images into .shots/chrome/before/ and copies to conversation artifacts.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4344;
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHOTS_DIR = path.resolve(__dirname, '../../../.shots/chrome/before');
const ARTIFACTS_DIR =
  'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

function startStaticServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.woff2': 'font/woff2',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url ? req.url.split('?')[0] : '/';
      if (reqPath.endsWith('/')) {
        reqPath += 'index.html';
      }

      let filePath = path.join(DIST_DIR, reqPath);
      if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath += '.html';
      }
      if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        const notFoundPath = path.join(DIST_DIR, '404.html');
        if (fs.existsSync(notFoundPath)) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(notFoundPath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Preview server running at http://127.0.0.1:${PORT}/`);
      resolve(server);
    });
  });
}

interface ShotSpec {
  name: string;
  url: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  action?: (page: Page) => Promise<void>;
  clipToHeader?: boolean;
  clipToFooter?: boolean;
}

const VIEWPORTS = [
  { label: '1440', width: 1440, height: 900 },
  { label: '1024', width: 1024, height: 800 },
  { label: '768', width: 768, height: 1024 },
  { label: '390', width: 390, height: 844 },
];

const THEMES: Array<'dark' | 'light'> = ['dark', 'light'];

async function main() {
  const server = await startStaticServer();
  const browser = await chromium.launch();
  const manifest: Array<{ name: string; file: string; context: string; theme: string; width: number }> = [];

  try {
    const shots: ShotSpec[] = [];

    // 1. Landing Top (all viewports x themes)
    for (const vp of VIEWPORTS) {
      for (const th of THEMES) {
        shots.push({
          name: `landing-top-${vp.label}-${th}`,
          url: '/',
          width: vp.width,
          height: vp.height,
          theme: th,
          clipToHeader: true,
        });
      }
    }

    // 2. Landing Scrolled (all viewports x themes)
    for (const vp of VIEWPORTS) {
      for (const th of THEMES) {
        shots.push({
          name: `landing-scrolled-${vp.label}-${th}`,
          url: '/',
          width: vp.width,
          height: vp.height,
          theme: th,
          action: async (page) => {
            await page.evaluate(() => window.scrollTo(0, 300));
            await page.waitForTimeout(300);
          },
          clipToHeader: true,
        });
      }
    }

    // 3. Landing Mobile Menu Open (768 and 390 x themes)
    for (const vp of VIEWPORTS.filter((v) => v.width <= 768)) {
      for (const th of THEMES) {
        shots.push({
          name: `landing-menu-open-${vp.label}-${th}`,
          url: '/',
          width: vp.width,
          height: vp.height,
          theme: th,
          action: async (page) => {
            const toggle = page.locator('#rx-menu-toggle');
            if (await toggle.isVisible()) {
              await toggle.click();
              await page.waitForTimeout(300);
            }
          },
        });
      }
    }

    // 4. Landing Header Hover & Focus states (1440 dark)
    shots.push({
      name: `landing-header-hover-1440-dark`,
      url: '/',
      width: 1440,
      height: 900,
      theme: 'dark',
      action: async (page) => {
        const link = page.locator('.rx-header__nav-link').first();
        await link.hover();
        await page.waitForTimeout(300);
      },
      clipToHeader: true,
    });

    shots.push({
      name: `landing-header-focus-1440-dark`,
      url: '/',
      width: 1440,
      height: 900,
      theme: 'dark',
      action: async (page) => {
        await page.keyboard.press('Tab'); // focus skip link
        await page.waitForTimeout(200);
      },
      clipToHeader: true,
    });

    // 5. Landing Footer (all viewports x themes)
    for (const vp of VIEWPORTS) {
      for (const th of THEMES) {
        shots.push({
          name: `landing-footer-${vp.label}-${th}`,
          url: '/',
          width: vp.width,
          height: vp.height,
          theme: th,
          clipToFooter: true,
          action: async (page) => {
            await page.evaluate(() => {
              const footer = document.querySelector('footer');
              footer?.scrollIntoView();
            });
            await page.waitForTimeout(300);
          },
        });
      }
    }

    // 6. Docs Header & Footer (/getting-started/)
    for (const vp of VIEWPORTS) {
      for (const th of THEMES) {
        shots.push({
          name: `docs-header-${vp.label}-${th}`,
          url: '/getting-started/',
          width: vp.width,
          height: vp.height,
          theme: th,
          clipToHeader: true,
        });
      }
    }

    for (const vp of [VIEWPORTS[0], VIEWPORTS[3]]) {
      for (const th of THEMES) {
        shots.push({
          name: `docs-footer-${vp.label}-${th}`,
          url: '/getting-started/',
          width: vp.width,
          height: vp.height,
          theme: th,
          clipToFooter: true,
          action: async (page) => {
            await page.evaluate(() => {
              const footer = document.querySelector('footer');
              footer?.scrollIntoView();
            });
            await page.waitForTimeout(300);
          },
        });
      }
    }

    // 7. 404 Page (1440 & 390 x dark/light)
    for (const vp of [VIEWPORTS[0], VIEWPORTS[3]]) {
      for (const th of THEMES) {
        shots.push({
          name: `404-header-${vp.label}-${th}`,
          url: '/404/',
          width: vp.width,
          height: vp.height,
          theme: th,
          clipToHeader: true,
        });
      }
    }

    // 8. Playground Page (1440 & 390 x dark/light)
    for (const vp of [VIEWPORTS[0], VIEWPORTS[3]]) {
      for (const th of THEMES) {
        shots.push({
          name: `playground-header-${vp.label}-${th}`,
          url: '/playground/',
          width: vp.width,
          height: vp.height,
          theme: th,
          clipToHeader: true,
        });
      }
    }

    console.log(`Starting capture of ${shots.length} before shots...`);

    for (const shot of shots) {
      process.stdout.write(`Capturing ${shot.name}... `);
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        colorScheme: shot.theme,
      });

      const page = await context.newPage();
      const targetUrl = `http://127.0.0.1:${PORT}${shot.url}`;

      try {
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      } catch {
        await page.waitForLoadState('domcontentloaded');
      }

      // Apply theme
      await page.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
      }, shot.theme);

      await page.waitForTimeout(300);

      if (shot.action) {
        await shot.action(page);
      }

      const fileName = `${shot.name}.png`;
      const filePath = path.join(SHOTS_DIR, fileName);

      if (shot.clipToHeader) {
        const headerEl = await page.$('header');
        if (headerEl) {
          await headerEl.screenshot({ path: filePath });
        } else {
          await page.screenshot({ path: filePath, clip: { x: 0, y: 0, width: shot.width, height: 120 } });
        }
      } else if (shot.clipToFooter) {
        const footerEl = await page.$('footer');
        if (footerEl) {
          await footerEl.screenshot({ path: filePath });
        } else {
          await page.screenshot({ path: filePath, clip: { x: 0, y: Math.max(0, shot.height - 300), width: shot.width, height: 300 } });
        }
      } else {
        await page.screenshot({ path: filePath });
      }

      if (fs.existsSync(ARTIFACTS_DIR)) {
        try {
          fs.copyFileSync(filePath, path.join(ARTIFACTS_DIR, fileName));
        } catch {}
      }

      manifest.push({
        name: shot.name,
        file: fileName,
        context: shot.url,
        theme: shot.theme,
        width: shot.width,
      });

      console.log('Done.');
      await context.close();
    }

    // Generate HTML Contact Sheet for Before Shots
    const contactSheetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>REQNX Chrome — Before Redesign Contact Sheet</title>
  <style>
    body {
      background: #0b0d13;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 2rem;
    }
    h1 { font-family: monospace; color: #14ddfd; margin-bottom: 0.25rem; }
    p.lead { color: #94a3b8; margin-top: 0; margin-bottom: 2rem; font-size: 0.95rem; }
    .filter-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      background: #161923;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      align-items: center;
    }
    button {
      background: #1e2230;
      color: #cbd5e1;
      border: 1px solid rgba(255,255,255,0.15);
      padding: 0.45rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      font-family: monospace;
    }
    button:hover { background: #14ddfd; color: #0b0d13; border-color: #14ddfd; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: #12151f;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 0.5rem 0.85rem;
      background: #181c28;
      font-family: monospace;
      font-size: 0.78rem;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .card-img-wrap {
      background: #0f1117;
      padding: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card img {
      max-width: 100%;
      height: auto;
      border-radius: 3px;
      border: 1px solid rgba(255,255,255,0.05);
      transition: filter 0.15s ease;
    }
    body.is-squint img { filter: blur(4px); }
    body.is-greyscale img { filter: grayscale(100%); }
  </style>
</head>
<body>
  <h1>REQNX Chrome — Before Redesign Contact Sheet</h1>
  <p class="lead">Baseline visual capture across Landing, Docs, 404, and Playground in all viewports, themes, and interactive states.</p>
  <div class="filter-bar">
    <button onclick="document.body.classList.toggle('is-squint')">Squint Test (Blur)</button>
    <button onclick="document.body.classList.toggle('is-greyscale')">Greyscale Test</button>
    <button onclick="document.body.className = ''">Reset Filters</button>
  </div>
  <div class="grid">
    ${manifest
      .map(
        (m) => `
      <div class="card">
        <div class="card-header">
          <span>${m.name}</span>
          <span>${m.width}px · ${m.theme}</span>
        </div>
        <div class="card-img-wrap">
          <img src="${m.file}" alt="${m.name}" loading="lazy" />
        </div>
      </div>`,
      )
      .join('')}
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(SHOTS_DIR, 'index.html'), contactSheetHtml);
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'chrome-before-contact-sheet.html'), contactSheetHtml);
    }
    console.log(`\nBefore contact sheet generated at: ${path.join(SHOTS_DIR, 'index.html')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
