// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-chrome-mock-shots.ts
//
// Stage 1: Capture hi-fi screenshots of the chrome design mocks:
// - Marketing header (top, scrolled, flyout open, search focus)
// - Docs header (area tabs, section disclosure, search focus)
// - Mobile bar & sheet (closed, open)
// - Footers (full with/without ruler, slim docs)
// Across 1440, 1024, 768, 390px, dark and light modes.
// Generates Gate 1 visual review contact sheet.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4346;
const MOCKS_DIR = path.resolve(__dirname, '../../../docs/site/design/chrome-mocks');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SHOTS_DIR = path.resolve(__dirname, '../../../.shots/chrome/mocks');
const ARTIFACTS_DIR =
  'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

function startMocksServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const server = http.createServer((req, res) => {
      let reqPath = req.url ? req.url.split('?')[0] : '/';
      if (reqPath.endsWith('/')) {
        reqPath += 'index.html';
      }

      // If accessing brand assets e.g. /brand/logo.png
      let filePath = path.join(MOCKS_DIR, reqPath);
      if (reqPath.startsWith('/brand/')) {
        filePath = path.join(REPO_ROOT, reqPath);
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

interface MockShotSpec {
  name: string;
  mockFile: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  action?: (page: Page) => Promise<void>;
  clipToHeader?: boolean;
}

const SHOTS: MockShotSpec[] = [
  // Marketing Header - Top State (1440, 1024, 768, 390 x dark/light)
  { name: 'mock-marketing-top-1440-dark', mockFile: 'marketing-header.html', width: 1440, height: 900, theme: 'dark', clipToHeader: true },
  { name: 'mock-marketing-top-1440-light', mockFile: 'marketing-header.html', width: 1440, height: 900, theme: 'light', clipToHeader: true },
  { name: 'mock-marketing-top-1024-dark', mockFile: 'marketing-header.html', width: 1024, height: 800, theme: 'dark', clipToHeader: true },
  { name: 'mock-marketing-top-768-dark', mockFile: 'marketing-header.html', width: 768, height: 1024, theme: 'dark', clipToHeader: true },
  { name: 'mock-marketing-top-390-dark', mockFile: 'marketing-header.html', width: 390, height: 844, theme: 'dark', clipToHeader: true },

  // Marketing Header - Scrolled State (56px 92% solid + blur)
  {
    name: 'mock-marketing-scrolled-1440-dark',
    mockFile: 'marketing-header.html',
    width: 1440,
    height: 900,
    theme: 'dark',
    action: async (page) => {
      await page.evaluate(() => (window as any).setHeaderState('scrolled'));
      await page.waitForTimeout(200);
    },
    clipToHeader: true,
  },
  {
    name: 'mock-marketing-scrolled-1440-light',
    mockFile: 'marketing-header.html',
    width: 1440,
    height: 900,
    theme: 'light',
    action: async (page) => {
      await page.evaluate(() => (window as any).setHeaderState('scrolled'));
      await page.waitForTimeout(200);
    },
    clipToHeader: true,
  },

  // Marketing Header - Flyout Open (Decision 4)
  {
    name: 'mock-marketing-flyout-open-1440-dark',
    mockFile: 'marketing-header.html',
    width: 1440,
    height: 900,
    theme: 'dark',
    action: async (page) => {
      await page.evaluate(() => (window as any).toggleFlyout());
      await page.waitForTimeout(200);
    },
  },
  {
    name: 'mock-marketing-flyout-open-1440-light',
    mockFile: 'marketing-header.html',
    width: 1440,
    height: 900,
    theme: 'light',
    action: async (page) => {
      await page.evaluate(() => (window as any).toggleFlyout());
      await page.waitForTimeout(200);
    },
  },

  // Docs Header - Area Tabs (1280px+) (Decision 7)
  { name: 'mock-docs-tabs-1440-dark', mockFile: 'docs-header.html', width: 1440, height: 900, theme: 'dark', clipToHeader: true },
  { name: 'mock-docs-tabs-1440-light', mockFile: 'docs-header.html', width: 1440, height: 900, theme: 'light', clipToHeader: true },

  // Docs Header - Section Disclosure (1024-1279px) (Decision 7)
  {
    name: 'mock-docs-section-disclosure-1024-dark',
    mockFile: 'docs-header.html',
    width: 1024,
    height: 800,
    theme: 'dark',
    action: async (page) => {
      await page.evaluate(() => (window as any).setNavMode('narrow'));
      const btn = page.locator('#section-disclosure-btn');
      await btn.click();
      await page.waitForTimeout(200);
    },
  },

  // Docs Header - Search Focus State (Full 260px Trigger)
  {
    name: 'mock-docs-search-focus-1440-dark',
    mockFile: 'docs-header.html',
    width: 1440,
    height: 900,
    theme: 'dark',
    action: async (page) => {
      await page.evaluate(() => (window as any).toggleSearchFocus());
      await page.waitForTimeout(200);
    },
    clipToHeader: true,
  },

  // Mobile Bar & Sheet (Decision 1 & Modal Sheet)
  { name: 'mock-mobile-bar-closed-390-dark', mockFile: 'mobile-chrome.html', width: 440, height: 900, theme: 'dark' },
  {
    name: 'mock-mobile-sheet-open-390-dark',
    mockFile: 'mobile-chrome.html',
    width: 440,
    height: 900,
    theme: 'dark',
    action: async (page) => {
      await page.evaluate(() => (window as any).openSheet());
      await page.waitForTimeout(250);
    },
  },
  {
    name: 'mock-mobile-sheet-open-390-light',
    mockFile: 'mobile-chrome.html',
    width: 440,
    height: 900,
    theme: 'light',
    action: async (page) => {
      await page.evaluate(() => {
        (window as any).setAppTheme('light');
        (window as any).openSheet();
      });
      await page.waitForTimeout(250);
    },
  },

  // Footers: Full Marketing Footer (with Ruler Edge On) (Decision 6)
  {
    name: 'mock-footer-full-1440-dark',
    mockFile: 'footers.html',
    width: 1440,
    height: 900,
    theme: 'dark',
    action: async (page) => {
      const el = page.locator('#full-footer-preview');
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    },
  },
  {
    name: 'mock-footer-full-1440-light',
    mockFile: 'footers.html',
    width: 1440,
    height: 900,
    theme: 'light',
    action: async (page) => {
      await page.evaluate(() => (window as any).setTheme('light'));
      const el = page.locator('#full-footer-preview');
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    },
  },

  // Footers: Slim Docs Footer
  {
    name: 'mock-footer-slim-1440-dark',
    mockFile: 'footers.html',
    width: 1440,
    height: 900,
    theme: 'dark',
    action: async (page) => {
      const el = page.locator('#slim-footer-preview');
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    },
  },
];

async function main() {
  const server = await startMocksServer();
  const browser = await chromium.launch();
  const manifest: Array<{ name: string; file: string; theme: string; width: number }> = [];

  try {
    console.log(`Capturing ${SHOTS.length} mock review screenshots...`);

    for (const shot of SHOTS) {
      process.stdout.write(`Capturing ${shot.name}... `);
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        colorScheme: shot.theme,
      });

      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${shot.mockFile}`, { waitUntil: 'domcontentloaded' });

      // Apply initial theme
      await page.evaluate((th) => {
        document.documentElement.setAttribute('data-theme', th);
      }, shot.theme);

      await page.waitForTimeout(200);

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
          await page.screenshot({ path: filePath, clip: { x: 0, y: 0, width: shot.width, height: 80 } });
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
        theme: shot.theme,
        width: shot.width,
      });

      console.log('Done.');
      await context.close();
    }

    // Generate Gate 1 Contact Sheet HTML
    const contactSheetHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>REQNX Chrome — Gate 1 Mocks Contact Sheet</title>
  <style>
    body {
      background: #090a0f;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 2.5rem;
    }
    h1 { font-family: monospace; color: #14ddfd; margin-bottom: 0.5rem; }
    p.lead { color: #94a3b8; margin-top: 0; margin-bottom: 2rem; font-size: 0.95rem; }
    .toolbar {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      background: #111319;
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
    button:hover { background: #14ddfd; color: #090a0f; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: #111319;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 0.6rem 0.9rem;
      background: #161923;
      font-family: monospace;
      font-size: 0.8rem;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .card-img-wrap {
      background: #0f1117;
      padding: 0.5rem;
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
  <h1>REQNX Chrome — Gate 1 Hi-Fi Mocks Contact Sheet</h1>
  <p class="lead">Visual review across all 7 open decisions: 56px height, 92% solid surface, 2px underline marker, Algorithms flyout, 3-option theme control, ruler edge footer, and docs section disclosure.</p>
  <div class="toolbar">
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
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'chrome-mocks-contact-sheet.html'), contactSheetHtml);
    }
    console.log(`\nGate 1 mocks contact sheet generated at: ${path.join(SHOTS_DIR, 'index.html')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
