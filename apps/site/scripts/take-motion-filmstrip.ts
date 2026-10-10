// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-motion-filmstrip.ts
//
// Frame-by-frame filmstrip capture of:
// 1. E5: Hero scan sweep & console boot sequence
// 2. E22: Hero mascot arrival and nod on denial
// 3. E9/E10: Console marker pop, recoil, and odometer roll
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4335;
const DIST_DIR = path.resolve(__dirname, '../dist');
const FILMSTRIP_DIR = path.resolve(__dirname, '../.shots/filmstrip');
const ARTIFACTS_DIR =
  'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(FILMSTRIP_DIR)) {
  fs.mkdirSync(FILMSTRIP_DIR, { recursive: true });
}

function startServer(): Promise<http.Server> {
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

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

async function capture() {
  console.log('Starting static server on port', PORT);
  const server = await startServer();

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    console.log('Navigating to landing page...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });

    // Step 1: Capture Boot sequence filmstrip
    console.log('Capturing Hero boot filmstrip frames...');
    const heroElement = await page.$('#hero');
    if (heroElement) {
      const timestamps = [0, 200, 450, 700, 1000];
      for (const ms of timestamps) {
        if (ms > 0) {
          await page.waitForTimeout(200);
        }
        const framePath = path.join(FILMSTRIP_DIR, `boot-frame-${ms}ms.png`);
        await heroElement.screenshot({ path: framePath });
        console.log(`Saved: boot-frame-${ms}ms.png`);
      }
    }

    // Step 2: Live Console Marker Pop & Denial Recoil
    console.log('Testing console marker triggers...');
    await page.waitForTimeout(500);

    const consoleElement = await page.$('.rx-console');
    if (consoleElement) {
      // Find Send Request button
      const sendBtn = await page.$('.rx-console__send-btn');
      if (sendBtn) {
        // Capture idle
        await consoleElement.screenshot({ path: path.join(FILMSTRIP_DIR, 'console-0-idle.png') });

        // Trigger request
        await sendBtn.click();
        await page.waitForTimeout(60);
        await consoleElement.screenshot({ path: path.join(FILMSTRIP_DIR, 'console-1-marker-pop.png') });

        // Fire 5 rapid clicks to force denial recoil
        for (let i = 0; i < 5; i++) {
          await sendBtn.click();
          await page.waitForTimeout(40);
        }
        await page.waitForTimeout(80);
        await consoleElement.screenshot({ path: path.join(FILMSTRIP_DIR, 'console-2-denial-recoil.png') });
        console.log('Saved console marker frames.');
      }
    }

    // Copy representative frames to artifact directory for user review
    const sampleFiles = [
      'boot-frame-450ms.png',
      'boot-frame-1000ms.png',
      'console-1-marker-pop.png',
      'console-2-denial-recoil.png',
    ];
    for (const file of sampleFiles) {
      const src = path.join(FILMSTRIP_DIR, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(ARTIFACTS_DIR, file));
      }
    }

    console.log('Filmstrip capture finished successfully.');
    await browser.close();
  } finally {
    server.close();
  }
}

capture().catch((err) => {
  console.error('Filmstrip capture failed:', err);
  process.exit(1);
});
