// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-foundations-shots.ts
//
// Captures visual screenshots of the new Stage 2 Foundations pages:
// - /dev/mobile-qa on iPhone 15 Pro (390x844) & Galaxy S24 (360x800)
// - /dev/styleguide/mobile on iPhone 15 Pro (390x844) & Galaxy S24 (360x800)
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(SITE_ROOT, 'dist');
const SHOTS_DIR = path.resolve(SITE_ROOT, '.shots/mobile/foundations');
const ARTIFACTS_DIR = 'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';
const PORT = 4339;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
      const cleanPath = reqPath.replace(/\/$/, '');

      let filePath = path.join(DIST_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (!fs.existsSync(filePath) && fs.existsSync(path.join(DIST_DIR, `${cleanPath}.html`))) {
        filePath = path.join(DIST_DIR, `${cleanPath}.html`);
      }
      if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) {
        filePath = `${filePath}.html`;
      }
      if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function run() {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  const devices = [
    { name: 'iphone15pro', width: 390, height: 844, dpr: 3 },
    { name: 'galaxys24', width: 360, height: 800, dpr: 3 },
  ];

  try {
    for (const dev of devices) {
      const context = await browser.newContext({
        viewport: { width: dev.width, height: dev.height },
        deviceScaleFactor: dev.dpr,
        isMobile: true,
        hasTouch: true,
      });

      const page = await context.newPage();

      // 1. Mobile QA Workbench
      await page.goto(`${BASE_URL}/dev/mobile-qa/`, { waitUntil: 'networkidle' });
      const qaShotPath = path.join(SHOTS_DIR, `mobile-qa-${dev.name}-dark.png`);
      await page.screenshot({ path: qaShotPath, fullPage: false });
      console.log(`Saved: ${qaShotPath}`);

      // Copy to conversation artifacts
      fs.copyFileSync(qaShotPath, path.join(ARTIFACTS_DIR, `mobile-qa-${dev.name}-dark.png`));

      // 2. Mobile QA with Sheet Open
      const halfSheetBtn = page.locator('#qa-open-half-sheet');
      await halfSheetBtn.click();
      await page.waitForTimeout(350);
      const sheetShotPath = path.join(SHOTS_DIR, `mobile-qa-sheet-${dev.name}-dark.png`);
      await page.screenshot({ path: sheetShotPath, fullPage: false });
      console.log(`Saved: ${sheetShotPath}`);
      fs.copyFileSync(sheetShotPath, path.join(ARTIFACTS_DIR, `mobile-qa-sheet-${dev.name}-dark.png`));

      // Close sheet
      await page.locator('#demo-sheet-half-close').click();
      await page.waitForTimeout(350);

      // 3. Mobile Styleguide
      await page.goto(`${BASE_URL}/dev/styleguide/mobile/`, { waitUntil: 'networkidle' });
      const sgShotPath = path.join(SHOTS_DIR, `mobile-styleguide-${dev.name}-dark.png`);
      await page.screenshot({ path: sgShotPath, fullPage: false });
      console.log(`Saved: ${sgShotPath}`);
      fs.copyFileSync(sgShotPath, path.join(ARTIFACTS_DIR, `mobile-styleguide-${dev.name}-dark.png`));

      await context.close();
    }
    console.log('All foundation screenshots captured successfully.');
  } finally {
    await browser.close();
    server.close();
  }
}

run();
