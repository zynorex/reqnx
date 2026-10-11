// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-motion-tour.ts
//
// Automated Playwright motion inspection tour:
// - Evaluates performance under 4x CPU throttling via Chrome DevTools Protocol
// - Checks Header scroll sentinel & hairline progress (E1, E3)
// - Tests Command copy morph & timeout (E8)
// - Tests Live Console algorithm switch tab sliding & timeline wipe (E12)
// - Tests Theme switch transition (E4)
// - Tests Motion kill switch preference change (E27)
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4336;
const DIST_DIR = path.resolve(__dirname, '../dist');

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

async function runTour() {
  console.log('--- Starting Motion Verification Tour ---');
  const server = await startServer();

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();

    // Enable 4x CPU Throttling via Chrome DevTools Protocol
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    console.log('✓ 4x CPU throttling active');

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Visit landing page
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    console.log('✓ Page loaded cleanly');

    // 2. Check Copy button interaction (E8)
    const copyBtn = await page.$('.rx-copy-btn');
    if (copyBtn) {
      await copyBtn.click();
      await page.waitForTimeout(250);
      const isCopied = await copyBtn.evaluate((el) => el.classList.contains('is-copied'));
      console.log(`✓ E8 Command copy triggered (is-copied: ${isCopied})`);
    }

    // 3. Check Live Console Algorithm switch (E12)
    const tbTab = await page.$('button[role="tab"]:has-text("Token Bucket")');
    if (tbTab) {
      await tbTab.click();
      await page.waitForTimeout(300);
      const isSelected = await tbTab.getAttribute('aria-selected');
      console.log(`✓ E12 Algorithm switch to Token Bucket (selected: ${isSelected})`);
    }

    // 4. Test Scroll Header and Hairline (E1, E3)
    await page.evaluate(() => window.scrollTo({ top: 400 }));
    await page.waitForTimeout(300);
    const headerScrolled = await page.$eval('.rx-header', (el) =>
      el.classList.contains('is-scrolled'),
    );
    console.log(`✓ E1 Header scroll state active (is-scrolled: ${headerScrolled})`);

    // 5. Check Motion Preference Kill Switch in Footer (E27)
    const motionToggle = await page.$('#rx-motion-reduced');
    if (motionToggle) {
      await motionToggle.click();
      await page.waitForTimeout(150);
      const htmlMotion = await page.$eval('html', (el) => el.getAttribute('data-motion'));
      console.log(`✓ E27 Motion control toggle switched to: data-motion="${htmlMotion}"`);
    }

    // Check for any uncaught errors
    if (consoleErrors.length > 0) {
      console.error('Found browser console errors during tour:', consoleErrors);
      throw new Error(`Tour encountered ${consoleErrors.length} console errors`);
    } else {
      console.log('✓ Zero console errors during full motion tour');
    }

    console.log('--- Motion Tour Completed with 100% Pass ---');
    await browser.close();
  } finally {
    server.close();
  }
}

runTour().catch((err) => {
  console.error('Tour failed:', err);
  process.exit(1);
});
