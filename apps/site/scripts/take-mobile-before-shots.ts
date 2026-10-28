// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-mobile-before-shots.ts
//
// Stage 0: Capture BEFORE screenshots of every page type on the device matrix
// (portrait, light and dark) into .shots/mobile/before/ and copy to conversation artifacts.
// Generates an interactive contact sheet HTML.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4349;
const DIST_DIR = path.resolve(__dirname, '../dist');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SHOTS_DIR = path.resolve(REPO_ROOT, '.shots/mobile/before');
const ARTIFACTS_DIR = 'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

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

interface DeviceSpec {
  id: string;
  label: string;
  width: number;
  height: number;
  dpr: number;
  hasTouch: boolean;
  isMobile: boolean;
}

// 2026 Mobile Device Matrix per specification
const DEVICE_MATRIX: DeviceSpec[] = [
  { id: '390x844', label: 'iPhone 12/13/14 Standard (390×844)', width: 390, height: 844, dpr: 3, hasTouch: true, isMobile: true },
  { id: '360x800', label: 'Samsung Galaxy / Android Standard (360×800)', width: 360, height: 800, dpr: 2.5, hasTouch: true, isMobile: true },
  { id: '393x873', label: 'Google Pixel 7/8 / S24 (393×873)', width: 393, height: 873, dpr: 2.75, hasTouch: true, isMobile: true },
  { id: '375x812', label: 'iPhone X/XS/11 Pro/13 mini (375×812)', width: 375, height: 812, dpr: 3, hasTouch: true, isMobile: true },
  { id: '414x896', label: 'iPhone XR / 11 (414×896)', width: 414, height: 896, dpr: 2, hasTouch: true, isMobile: true },
  { id: '430x932', label: 'iPhone Pro Max (430×932)', width: 430, height: 932, dpr: 3, hasTouch: true, isMobile: true },
  { id: '360x780', label: 'Compact Android (360×780)', width: 360, height: 780, dpr: 2.5, hasTouch: true, isMobile: true },
  { id: '384x832', label: 'Pixel 6/7a (384×832)', width: 384, height: 832, dpr: 2.625, hasTouch: true, isMobile: true },
  { id: '320x568', label: 'Stress Small Phone (320×568)', width: 320, height: 568, dpr: 2, hasTouch: true, isMobile: true },
  { id: '600x900', label: 'Foldable / Compact Tablet (600×900)', width: 600, height: 900, dpr: 2, hasTouch: true, isMobile: true },
  { id: '768x1024', label: 'Small Tablet Portrait (768×1024)', width: 768, height: 1024, dpr: 2, hasTouch: true, isMobile: true },
];

interface ShotConfig {
  name: string;
  pageType: 'landing' | 'docs-reading' | 'docs-reference' | 'playground' | '404' | 'mobile-menu';
  url: string;
  device: DeviceSpec;
  theme: 'dark' | 'light';
  fullPage: boolean;
  action?: (page: Page) => Promise<void>;
}

async function captureShot(page: Page, config: ShotConfig): Promise<string> {
  const filename = `${config.name}.png`;
  const filePath = path.join(SHOTS_DIR, filename);

  await page.setViewportSize({ width: config.device.width, height: config.device.height });
  await page.goto(`http://127.0.0.1:${PORT}${config.url}`, { waitUntil: 'networkidle' });

  // Apply theme
  await page.evaluate((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme;
  }, config.theme);

  // Wait for fonts & rendering
  await page.waitForTimeout(400);

  if (config.action) {
    await config.action(page);
    await page.waitForTimeout(300);
  }

  await page.screenshot({
    path: filePath,
    fullPage: config.fullPage,
  });

  // Copy to conversation artifacts
  if (fs.existsSync(ARTIFACTS_DIR)) {
    const artifactPath = path.join(ARTIFACTS_DIR, filename);
    try {
      fs.copyFileSync(filePath, artifactPath);
    } catch {}
  }

  return filename;
}

async function main() {
  console.log('--- Starting Stage 0 Mobile BEFORE Screenshot Capture ---');
  const server = await startStaticServer();
  const browser = await chromium.launch();

  const manifest: Array<{
    name: string;
    file: string;
    pageType: string;
    device: string;
    width: number;
    height: number;
    theme: string;
    fullPage: boolean;
  }> = [];

  try {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();

    // 1. Landing Page First Screen across all devices in matrix (dark & light)
    for (const dev of DEVICE_MATRIX) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-landing-firstscreen-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: 'landing',
          url: '/',
          device: dev,
          theme: th,
          fullPage: false,
        });
        manifest.push({
          name,
          file,
          pageType: 'landing (first screen)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: false,
        });
      }
    }

    // 2. Landing Page Full-page on primary devices (390, 360, 320, 768)
    const fullPageDevices = DEVICE_MATRIX.filter((d) => ['390x844', '360x800', '320x568', '768x1024'].includes(d.id));
    for (const dev of fullPageDevices) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-landing-fullpage-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: 'landing',
          url: '/',
          device: dev,
          theme: th,
          fullPage: true,
        });
        manifest.push({
          name,
          file,
          pageType: 'landing (full page)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: true,
        });
      }
    }

    // 3. Current Mobile Menu Open on Landing (390 and 360 x dark/light)
    for (const dev of DEVICE_MATRIX.filter((d) => ['390x844', '360x800'].includes(d.id))) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-landing-menu-open-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: 'mobile-menu',
          url: '/',
          device: dev,
          theme: th,
          fullPage: false,
          action: async (p) => {
            const toggle = p.locator('#rx-menu-toggle, button[aria-label*="menu" i], button.starlight-menu-button').first();
            if (await toggle.isVisible()) {
              await toggle.click();
              await p.waitForTimeout(300);
            }
          },
        });
        manifest.push({
          name,
          file,
          pageType: 'mobile menu (current)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: false,
        });
      }
    }

    // 4. Docs Reading Page (/getting-started/) on 390, 360, 320, 768 x dark/light
    for (const dev of fullPageDevices) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-docs-reading-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: 'docs-reading',
          url: '/getting-started/',
          device: dev,
          theme: th,
          fullPage: false,
        });
        manifest.push({
          name,
          file,
          pageType: 'docs reading (/getting-started/)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: false,
        });
      }
    }

    // 5. Docs Reference / Architecture Page (/design/architecture/) on 390, 360 x dark/light
    for (const dev of DEVICE_MATRIX.filter((d) => ['390x844', '360x800'].includes(d.id))) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-docs-reference-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: 'docs-reference',
          url: '/design/architecture/',
          device: dev,
          theme: th,
          fullPage: false,
        });
        manifest.push({
          name,
          file,
          pageType: 'docs reference (/design/architecture/)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: false,
        });
      }
    }

    // 6. Playground Page (/playground/) on 390, 360, 320 x dark/light
    for (const dev of DEVICE_MATRIX.filter((d) => ['390x844', '360x800', '320x568'].includes(d.id))) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-playground-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: 'playground',
          url: '/playground/',
          device: dev,
          theme: th,
          fullPage: false,
        });
        manifest.push({
          name,
          file,
          pageType: 'playground (/playground/)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: false,
        });
      }
    }

    // 7. 404 Page (/404/) on 390, 360, 320 x dark/light
    for (const dev of DEVICE_MATRIX.filter((d) => ['390x844', '360x800', '320x568'].includes(d.id))) {
      for (const th of ['dark', 'light'] as const) {
        const name = `before-404-${dev.id}-${th}`;
        console.log(`Capturing: ${name}`);
        const file = await captureShot(page, {
          name,
          pageType: '404',
          url: '/404/',
          device: dev,
          theme: th,
          fullPage: false,
        });
        manifest.push({
          name,
          file,
          pageType: '404 (/404/)',
          device: dev.label,
          width: dev.width,
          height: dev.height,
          theme: th,
          fullPage: false,
        });
      }
    }

    // Generate Contact Sheet HTML
    const contactSheetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>REQNX Mobile Experience — Stage 0 BEFORE Contact Sheet</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      background: #090d16;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.8rem;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }
    p.lead {
      color: #94a3b8;
      margin: 0 0 1rem 0;
      font-size: 0.95rem;
      max-width: 800px;
    }
    .filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }
    button {
      background: #181c28;
      border: 1px solid rgba(255,255,255,0.15);
      color: #cbd5e1;
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    button:hover {
      background: #23293a;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: #12151f;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 0.6rem 0.85rem;
      background: #181c28;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.78rem;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .card-img-wrap {
      background: #0b0d13;
      padding: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 250px;
    }
    .card img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.05);
      transition: filter 0.15s ease;
    }
    body.is-squint img { filter: blur(4px); }
    body.is-greyscale img { filter: grayscale(100%); }
  </style>
</head>
<body>
  <header>
    <h1>REQNX Mobile Experience — Stage 0 BEFORE Contact Sheet</h1>
    <p class="lead">Baseline visual captures across the entire site prior to the flagship mobile experience implementation. Includes Landing, Docs (reading & reference), Playground, 404, and mobile navigation across the comprehensive 2026 mobile device matrix.</p>
    <div class="filters">
      <button onclick="document.body.classList.toggle('is-squint')">Squint Test (Blur)</button>
      <button onclick="document.body.classList.toggle('is-greyscale')">Greyscale Test</button>
      <button onclick="document.body.className = ''">Reset Filters</button>
    </div>
  </header>
  <div class="grid">
    ${manifest
      .map(
        (m) => `
    <div class="card" data-page="${m.pageType}">
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
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile-before-contact-sheet.html'), contactSheetHtml);
    }

    const manifestJson = path.join(SHOTS_DIR, 'manifest.json');
    fs.writeFileSync(manifestJson, JSON.stringify(manifest, null, 2));

    console.log(`\nSuccessfully captured ${manifest.length} BEFORE screenshots.`);
    console.log(`Contact sheet saved at: ${path.join(SHOTS_DIR, 'index.html')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
