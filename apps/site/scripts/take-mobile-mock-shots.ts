// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-mobile-mock-shots.ts
//
// Stage 1: Capture hi-fi screenshots of the mobile design mocks:
// - Landing first screen & 6-frame scroll storyboard
// - Dock in each state (Landing vs Docs)
// - Menu bottom sheet
// - Search sheet
// - Docs reading page with contents sheet
// - Playground mobile view
// Across 390x844 (iPhone) and 360x800 (Android), dark and light modes.
// Generates Gate 1 visual review contact sheet.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4351;
const MOCKS_DIR = path.resolve(__dirname, '../../../docs/site/design/mobile-mocks');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SHOTS_DIR = path.resolve(__dirname, '../../../.shots/mobile/mocks');
const ARTIFACTS_DIR = 'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

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
        res.end('Not Found: ' + reqPath);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Mobile mocks server running at http://127.0.0.1:${PORT}/`);
      resolve(server);
    });
  });
}

interface MockShotSpec {
  name: string;
  view: string;
  deviceType: 'iphone' | 'android';
  theme: 'dark' | 'light';
  action?: (page: Page) => Promise<void>;
  description: string;
}

const SHOT_SPECS: MockShotSpec[] = [
  // 1. Landing First Screen (Hero, status pill, 48px CTA, console stage)
  {
    name: 'mock-landing-hero-390-dark',
    view: 'landing',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Landing first screen (390×844 dark) showing status pill, H1, 48px primary CTA in thumb zone, and simplified mobile console',
  },
  {
    name: 'mock-landing-hero-390-light',
    view: 'landing',
    deviceType: 'iphone',
    theme: 'light',
    description: 'Landing first screen (390×844 light) on warm cream canvas',
  },
  {
    name: 'mock-landing-hero-360-dark',
    view: 'landing',
    deviceType: 'android',
    theme: 'dark',
    description: 'Landing first screen (360×800 dark) on Android viewport',
  },
  {
    name: 'mock-landing-hero-360-light',
    view: 'landing',
    deviceType: 'android',
    theme: 'light',
    description: 'Landing first screen (360×800 light) on Android viewport',
  },

  // 2. Landing Architecture Platform section
  {
    name: 'mock-landing-platform-390-dark',
    view: 'landing',
    deviceType: 'iphone',
    theme: 'dark',
    action: async (p) => {
      await p.evaluate(() => {
        document.getElementById('sec-arch')?.scrollIntoView();
      });
    },
    description: 'Architecture platform with vertical flow card and stacked 56px stat cells',
  },

  // 3. Landing Proof & Tiers scroll rails
  {
    name: 'mock-landing-tiers-390-dark',
    view: 'landing',
    deviceType: 'iphone',
    theme: 'dark',
    action: async (p) => {
      await p.evaluate(() => {
        document.getElementById('sec-tiers')?.scrollIntoView();
      });
    },
    description: 'Algorithm tiers scroll-snap rail (86% width with peek of next, dots, Prev/Next tap buttons)',
  },

  // 4. Dock in each state (Landing vs Docs)
  {
    name: 'mock-dock-landing-390-dark',
    view: 'landing',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Thumb dock on landing page: [Home] [Docs] [Search] [Menu] with 2px cyan active indicator',
  },
  {
    name: 'mock-dock-docs-390-dark',
    view: 'docs',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Thumb dock on docs pages: [Home] [Contents] [Search] [Menu] with Contents action',
  },

  // 5. Menu bottom sheet
  {
    name: 'mock-sheet-menu-390-dark',
    view: 'menu',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Menu bottom sheet with drag handle, close button, navigation rows, and preferences segmented controls',
  },
  {
    name: 'mock-sheet-menu-390-light',
    view: 'menu',
    deviceType: 'iphone',
    theme: 'light',
    description: 'Menu bottom sheet in light theme',
  },

  // 6. Search sheet (full screen)
  {
    name: 'mock-sheet-search-390-dark',
    view: 'search',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Search sheet with 52px input (16px text), cancel button, breadcrumbed search results',
  },
  {
    name: 'mock-sheet-search-360-dark',
    view: 'search',
    deviceType: 'android',
    theme: 'dark',
    description: 'Search sheet on Android 360×800',
  },

  // 7. Docs Reading page + Contents bottom sheet
  {
    name: 'mock-docs-reading-390-dark',
    view: 'docs',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Docs reading experience: 17px/1.6 body, full-bleed code block with edge fades and 44px copy button, stacked data table',
  },
  {
    name: 'mock-docs-toc-390-dark',
    view: 'docs',
    deviceType: 'iphone',
    theme: 'dark',
    action: async (p) => {
      await p.evaluate(() => {
        (window as any).toggleToc(true);
      });
    },
    description: 'Docs Table of Contents bottom sheet opened from dock "Contents" button',
  },

  // 8. Playground mobile view
  {
    name: 'mock-playground-390-dark',
    view: 'playground',
    deviceType: 'iphone',
    theme: 'dark',
    description: 'Playground mobile: full-bleed canvas timeline, thumb pills for Send One and Send Burst, controls pill',
  },
  {
    name: 'mock-playground-360-dark',
    view: 'playground',
    deviceType: 'android',
    theme: 'dark',
    description: 'Playground mobile on Galaxy S24 Android 360×800',
  },
];

async function main() {
  const server = await startMocksServer();
  const browser = await chromium.launch();
  const manifest: Array<{ name: string; file: string; description: string; device: string; theme: string }> = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1100 },
    });

    for (const spec of SHOT_SPECS) {
      console.log(`Capturing mock: ${spec.name}`);
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });

      // Configure device type & theme & view
      await page.evaluate(
        ({ dev, th, vw }) => {
          (window as any).setDevice(dev);
          if (th === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            const btn = document.getElementById('btn-theme-toggle');
            if (btn) btn.textContent = 'Theme: Light';
          } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            const btn = document.getElementById('btn-theme-toggle');
            if (btn) btn.textContent = 'Theme: Dark';
          }
          (window as any).showView(vw);
        },
        { dev: spec.deviceType, th: spec.theme, vw: spec.view },
      );

      await page.waitForTimeout(300);

      if (spec.action) {
        await spec.action(page);
        await page.waitForTimeout(300);
      }

      const shell = page.locator('#phone-frame');
      const filename = `${spec.name}.png`;
      const outPath = path.join(SHOTS_DIR, filename);

      await shell.screenshot({ path: outPath });

      if (fs.existsSync(ARTIFACTS_DIR)) {
        try {
          fs.copyFileSync(outPath, path.join(ARTIFACTS_DIR, filename));
        } catch {}
      }

      manifest.push({
        name: spec.name,
        file: filename,
        description: spec.description,
        device: spec.deviceType === 'iphone' ? 'iPhone 14/15 (390×844)' : 'Galaxy S24 (360×800)',
        theme: spec.theme,
      });
    }

    // Generate Gate 1 Mocks Contact Sheet
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>REQNX Flagship Mobile — Gate 1 Mocks Contact Sheet</title>
  <style>
    body { background: #080a0f; color: #f1f5f9; font-family: -apple-system, sans-serif; padding: 2rem; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    p.lead { color: #94a3b8; margin-bottom: 2rem; max-width: 800px; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 2rem; }
    .card { background: #111420; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .card-head { padding: 0.75rem 1rem; background: #161b2c; font-family: monospace; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; }
    .card-body { padding: 1.5rem; display: flex; align-items: center; justify-content: center; background: #0b0e17; }
    .card-body img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .card-desc { padding: 0.75rem 1rem; font-size: 0.85rem; color: #94a3b8; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.06); }
  </style>
</head>
<body>
  <h1>REQNX Flagship Mobile Experience — Gate 1 Hi-Fi Mocks</h1>
  <p class="lead">Static design mocks for Gate 1 approval across iPhone 390×844 and Android 360×800 (Dark and Light themes). Covers Landing hero & scroll storyboard, thumb dock system, bottom sheets (menu & contents), full-screen search, and interactive playground.</p>
  <div class="grid">
    ${manifest
      .map(
        (m) => `
    <div class="card">
      <div class="card-head">
        <span>${m.name}</span>
        <span>${m.device} · ${m.theme}</span>
      </div>
      <div class="card-body">
        <img src="${m.file}" alt="${m.name}" loading="lazy" />
      </div>
      <div class="card-desc">${m.description}</div>
    </div>`,
      )
      .join('')}
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(SHOTS_DIR, 'index.html'), html);
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile-mocks-contact-sheet.html'), html);
    }

    console.log(`\nSuccessfully captured ${manifest.length} hi-fi mobile mock screenshots.`);
    console.log(`Gate 1 contact sheet saved at: ${path.join(SHOTS_DIR, 'index.html')}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
