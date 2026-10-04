// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-shots.ts
//
// Playwright screenshot matrix generator for visual review loop:
// - Viewports: 1440, 390 (both light and dark), plus 320, 1920, 2560
// - Captures hero stage and full page
// - Generates HTML contact sheet with squint (blur) and greyscale toggles
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 4333;
const DIST_DIR = path.resolve(import.meta.dirname, '../dist');
const SHOTS_DIR = path.resolve(import.meta.dirname, '../.shots');
const ARTIFACTS_DIR =
  'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

// Simple static HTTP server for dist/
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
      '.jpg': 'image/jpeg',
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
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Preview server running at http://127.0.0.1:${PORT}/`);
      resolve(server);
    });
  });
}

interface ShotConfig {
  name: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  heroOnly?: boolean;
}

const SHOTS: ShotConfig[] = [
  { name: 'desktop-1440-dark', width: 1440, height: 900, theme: 'dark' },
  { name: 'desktop-1440-light', width: 1440, height: 900, theme: 'light' },
  { name: 'mobile-390-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'mobile-390-light', width: 390, height: 844, theme: 'light' },
  { name: 'narrow-320-dark', width: 320, height: 640, theme: 'dark' },
  { name: 'wide-1920-dark', width: 1920, height: 1080, theme: 'dark' },
  { name: 'ultrawide-2560-dark', width: 2560, height: 1440, theme: 'dark' },
];

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const manifest: Array<{
    name: string;
    file: string;
    width: number;
    height: number;
    theme: string;
  }> = [];

  try {
    for (const shot of SHOTS) {
      console.log(`Capturing: ${shot.name} (${shot.width}x${shot.height}, ${shot.theme})...`);
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        colorScheme: shot.theme,
      });

      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });

      // Force theme attribute
      await page.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      }, shot.theme);

      // Wait 300ms for stable layout
      await page.waitForTimeout(300);

      const fileName = `${shot.name}.png`;
      const filePath = path.join(SHOTS_DIR, fileName);
      await page.screenshot({ path: filePath, fullPage: false });

      // Copy to artifacts dir if available
      if (fs.existsSync(ARTIFACTS_DIR)) {
        fs.copyFileSync(filePath, path.join(ARTIFACTS_DIR, fileName));
      }

      manifest.push({
        name: shot.name,
        file: fileName,
        width: shot.width,
        height: shot.height,
        theme: shot.theme,
      });

      await context.close();
    }

    // Generate HTML Contact Sheet
    const contactSheetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>REQNX Landing — Visual Review Contact Sheet</title>
  <style>
    body {
      background: #0f1117;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 2rem;
    }
    h1 { font-family: monospace; margin-bottom: 0.5rem; }
    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      background: #161923;
      padding: 1rem;
      border-radius: 8px;
    }
    button {
      background: #282d40;
      color: #fff;
      border: 1px solid #6366f1;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #6366f1; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
      gap: 2rem;
    }
    .card {
      background: #161923;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .card-header {
      padding: 0.75rem 1rem;
      background: #1e2230;
      font-family: monospace;
      font-size: 0.85rem;
      display: flex;
      justify-content: space-between;
    }
    .card img {
      width: 100%;
      height: auto;
      display: block;
      transition: filter 0.2s;
    }
    body.is-squint img { filter: blur(3px); }
    body.is-greyscale img { filter: grayscale(100%); }
    body.is-both img { filter: grayscale(100%) blur(3px); }
  </style>
</head>
<body>
  <h1>REQNX Landing Visual Review Contact Sheet</h1>
  <div class="controls">
    <button onclick="toggleMode('squint')">Toggle Squint Test (Blur)</button>
    <button onclick="toggleMode('greyscale')">Toggle Greyscale (Contrast)</button>
    <button onclick="resetFilters()">Reset Filters</button>
  </div>
  <div class="grid">
    ${manifest
      .map(
        (m) => `
      <div class="card">
        <div class="card-header">
          <span>${m.name}</span>
          <span>${m.width}x${m.height} · ${m.theme}</span>
        </div>
        <img src="${m.file}" alt="${m.name}" />
      </div>`,
      )
      .join('')}
  </div>
  <script>
    function toggleMode(mode) {
      if (mode === 'squint') document.body.classList.toggle('is-squint');
      if (mode === 'greyscale') document.body.classList.toggle('is-greyscale');
    }
    function resetFilters() {
      document.body.className = '';
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(SHOTS_DIR, 'index.html'), contactSheetHtml);
    console.log(`\nContact sheet generated at: ${path.join(SHOTS_DIR, 'index.html')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
