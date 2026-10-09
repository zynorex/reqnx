// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-shots.ts
//
// Playwright screenshot matrix generator for visual review loop:
// - Viewports: 1440, 390 (light and dark), plus 320, 1920, 2560
// - Captures hero stage, 404 page at deep missing path
// - Generates HTML contact sheet with squint, greyscale, and favicon previews
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4333;
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHOTS_DIR = path.resolve(__dirname, '../.shots');
const ARTIFACTS_DIR =
  'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

// Static HTTP server for dist/ that serves dist/404.html on arbitrary missing routes
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

interface ShotConfig {
  name: string;
  urlPath?: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
}

const SHOTS: ShotConfig[] = [
  { name: 'desktop-1440-dark', urlPath: '/', width: 1440, height: 900, theme: 'dark' },
  { name: 'desktop-1440-light', urlPath: '/', width: 1440, height: 900, theme: 'light' },
  { name: 'mobile-390-dark', urlPath: '/', width: 390, height: 844, theme: 'dark' },
  { name: 'mobile-390-light', urlPath: '/', width: 390, height: 844, theme: 'light' },
  { name: 'narrow-320-dark', urlPath: '/', width: 320, height: 640, theme: 'dark' },
  { name: 'wide-1920-dark', urlPath: '/', width: 1920, height: 1080, theme: 'dark' },
  { name: 'ultrawide-2560-dark', urlPath: '/', width: 2560, height: 1440, theme: 'dark' },
  // 404 at deep missing path
  { name: '404-desktop-1440-dark', urlPath: '/deeply/nested/missing/route', width: 1440, height: 900, theme: 'dark' },
  { name: '404-mobile-390-dark', urlPath: '/deeply/nested/missing/route', width: 390, height: 844, theme: 'dark' },
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
      const targetUrl = `http://127.0.0.1:${PORT}${shot.urlPath ?? '/'}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle' }).catch(() => {});

      // Force theme attribute
      await page.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      }, shot.theme);

      await page.waitForTimeout(400);

      const fileName = `${shot.name}.png`;
      const filePath = path.join(SHOTS_DIR, fileName);
      await page.screenshot({ path: filePath, fullPage: false });

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
  <title>REQNX Landing & 404 — Visual Review Contact Sheet</title>
  <style>
    body {
      background: #090a0f;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 2rem;
    }
    h1 { font-family: monospace; margin-bottom: 0.5rem; color: #14ddfd; }
    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      background: #111319;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    button {
      background: #1e2230;
      color: #fff;
      border: 1px solid #14ddfd;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover { background: #14ddfd; color: #000; }
    .favicon-section {
      background: #111319;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .favicon-grid {
      display: flex;
      gap: 2rem;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .fav-tab {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-family: monospace;
    }
    .fav-tab--dark { background: #181a20; color: #fff; border: 1px solid #333; }
    .fav-tab--light { background: #f1f3f5; color: #111; border: 1px solid #ccc; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
      gap: 2rem;
    }
    .card {
      background: #111319;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .card-header {
      padding: 0.75rem 1rem;
      background: #161923;
      font-family: monospace;
      font-size: 0.85rem;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
    }
    .card img {
      width: 100%;
      height: auto;
      display: block;
      transition: filter 0.2s;
    }
    body.is-squint img { filter: blur(4px); }
    body.is-greyscale img { filter: grayscale(100%); }
  </style>
</head>
<body>
  <h1>REQNX Landing & 404 Visual Review Contact Sheet</h1>
  <div class="controls">
    <button onclick="toggleMode('squint')">Squint Test (Blur)</button>
    <button onclick="toggleMode('greyscale')">Greyscale (Contrast)</button>
    <button onclick="resetFilters()">Reset Filters</button>
  </div>

  <div class="favicon-section">
    <h2 style="font-size: 1rem; margin: 0; color: #fcb020;">Favicon Browser Tab Previews (16px, 32px, 48px)</h2>
    <div class="favicon-grid">
      <div class="fav-tab fav-tab--dark">
        <img src="../public/favicon-16.png" width="16" height="16" alt="16px dark" />
        <span>16px Dark Tab</span>
      </div>
      <div class="fav-tab fav-tab--dark">
        <img src="../public/favicon-32.png" width="32" height="32" alt="32px dark" />
        <span>32px Dark Tab</span>
      </div>
      <div class="fav-tab fav-tab--light">
        <img src="../public/favicon-16.png" width="16" height="16" alt="16px light" />
        <span>16px Light Tab</span>
      </div>
      <div class="fav-tab fav-tab--light">
        <img src="../public/favicon-32.png" width="32" height="32" alt="32px light" />
        <span>32px Light Tab</span>
      </div>
    </div>
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
