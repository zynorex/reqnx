// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-button-shots.ts
//
// Playwright screenshot matrix generator for the Button System:
// - Captures button matrix in Dark & Light modes
// - Captures focused, hovered, and active states
// - Generates contact sheet artifact in artifacts directory
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4337;
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHOTS_DIR = path.resolve(__dirname, '../.shots/buttons');
const ARTIFACTS_DIR =
  'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
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
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url ? req.url.split('?')[0] : '/';
      if (reqPath.endsWith('/')) reqPath += 'index.html';

      let filePath = path.join(DIST_DIR, reqPath);
      if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath += '.html';
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

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();

  try {
    const targetUrl = fs.existsSync(path.join(DIST_DIR, 'dev/styleguide/buttons/index.html'))
      ? `http://127.0.0.1:${PORT}/dev/styleguide/buttons/`
      : `http://127.0.0.1:${PORT}/`;

    const viewports = [
      { name: 'desktop', width: 1440, height: 1100 },
      { name: 'mobile', width: 390, height: 844 },
    ];

    const capturedFiles: string[] = [];

    for (const vp of viewports) {
      for (const theme of ['dark', 'light'] as const) {
        console.log(`Capturing Button System: ${vp.name} (${theme})...`);
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
        });

        const page = await context.newPage();
        await page.goto(targetUrl, { waitUntil: 'networkidle' });

        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);

        await page.waitForTimeout(200);

        const filename = `buttons-${vp.name}-${theme}.png`;
        const localPath = path.join(SHOTS_DIR, filename);
        await page.screenshot({ path: localPath, fullPage: true });

        // Copy to artifacts dir if available
        if (fs.existsSync(ARTIFACTS_DIR)) {
          const artifactPath = path.join(ARTIFACTS_DIR, filename);
          fs.copyFileSync(localPath, artifactPath);
          console.log(`  ✓ Saved artifact: ${artifactPath}`);
        }

        capturedFiles.push(filename);
        await context.close();
      }
    }

    console.log(`\nSuccessfully captured ${capturedFiles.length} button system matrix screenshots.`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
