// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/landing-v3-stage0.ts
//
// Landing v3 Stage 0 Orient Script:
// - Captures BEFORE screenshots of `/` (1440, 1024, 768, 390 x light/dark)
// - Saves to .shots/landing-v3/before/
// - Measures performance baselines (LCP, CLS, FCP, TBT, JS/CSS bundle sizes)
// - Emits docs/site/landing-v3-baseline.json
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4355;
const DIST_DIR = path.resolve(__dirname, '../dist');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BEFORE_DIR = path.resolve(REPO_ROOT, '.shots/landing-v3/before');
const BASELINE_JSON = path.resolve(REPO_ROOT, 'docs/site/landing-v3-baseline.json');
const ARTIFACTS_DIR = 'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(BEFORE_DIR)) {
  fs.mkdirSync(BEFORE_DIR, { recursive: true });
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

    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function getGzipSize(filePath: string): { raw: number; gzip: number } {
  const content = fs.readFileSync(filePath);
  const compressed = zlib.gzipSync(content);
  return {
    raw: content.length,
    gzip: compressed.length,
  };
}

interface ShotSpec {
  name: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
}

const VIEWPORTS: ShotSpec[] = [
  { name: 'landing-before-1440-dark', width: 1440, height: 900, theme: 'dark' },
  { name: 'landing-before-1440-light', width: 1440, height: 900, theme: 'light' },
  { name: 'landing-before-1024-dark', width: 1024, height: 800, theme: 'dark' },
  { name: 'landing-before-1024-light', width: 1024, height: 800, theme: 'light' },
  { name: 'landing-before-768-dark', width: 768, height: 1024, theme: 'dark' },
  { name: 'landing-before-768-light', width: 768, height: 1024, theme: 'light' },
  { name: 'landing-before-390-dark', width: 390, height: 844, theme: 'dark' },
  { name: 'landing-before-390-light', width: 390, height: 844, theme: 'light' },
];

async function measureMetrics(browser: any, width: number, height: number) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    (window as unknown as { __clsScore: number }).__clsScore = 0;
    (window as unknown as { __lcp: number }).__lcp = 0;
    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput && typeof shift.value === 'number') {
            (window as unknown as { __clsScore: number }).__clsScore += shift.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          (window as unknown as { __lcp: number }).__lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
  });

  const startTime = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  const loadDurationMs = Date.now() - startTime;

  // Settle and scroll to observe CLS
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0;
    const win = window as unknown as { __clsScore?: number; __lcp?: number };
    return {
      fcp: Math.round(fcp),
      lcp: Math.round(win.__lcp ?? 0),
      cls: Number((win.__clsScore ?? 0).toFixed(4)),
      domContentLoaded: Math.round(timing?.domContentLoadedEventEnd ?? 0),
      load: Math.round(timing?.loadEventEnd ?? 0),
    };
  });

  await context.close();
  return { ...metrics, loadDurationMs };
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    console.log('Capturing Stage 0 BEFORE screenshots...');
    for (const spec of VIEWPORTS) {
      process.stdout.write(`Capturing ${spec.name}... `);
      const context = await browser.newContext({
        viewport: { width: spec.width, height: spec.height },
        colorScheme: spec.theme,
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });

      // Apply theme explicitly
      await page.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('rx-theme', theme);
      }, spec.theme);
      await page.waitForTimeout(300);

      const filePath = path.join(BEFORE_DIR, `${spec.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });

      if (fs.existsSync(ARTIFACTS_DIR)) {
        try {
          fs.copyFileSync(filePath, path.join(ARTIFACTS_DIR, `${spec.name}.png`));
        } catch {}
      }

      console.log('Done.');
      await context.close();
    }

    console.log('Measuring performance and bundle sizes...');
    const desktopMetrics = await measureMetrics(browser, 1440, 900);
    const mobileMetrics = await measureMetrics(browser, 390, 844);

    // Measure assets in dist/_astro
    const astroDir = path.join(DIST_DIR, '_astro');
    const assetSizes: Record<string, { raw: number; gzip: number }> = {};
    let totalClientJsRaw = 0;
    let totalClientJsGzip = 0;
    let totalClientCssRaw = 0;
    let totalClientCssGzip = 0;

    if (fs.existsSync(astroDir)) {
      const files = fs.readdirSync(astroDir);
      for (const file of files) {
        const fullPath = path.join(astroDir, file);
        if (fs.statSync(fullPath).isFile()) {
          const sz = getGzipSize(fullPath);
          assetSizes[file] = sz;
          if (file.endsWith('.js')) {
            totalClientJsRaw += sz.raw;
            totalClientJsGzip += sz.gzip;
          } else if (file.endsWith('.css')) {
            totalClientCssRaw += sz.raw;
            totalClientCssGzip += sz.gzip;
          }
        }
      }
    }

    // Measure HTML index size
    const indexHtmlPath = path.join(DIST_DIR, 'index.html');
    const indexHtmlSize = fs.existsSync(indexHtmlPath) ? getGzipSize(indexHtmlPath) : { raw: 0, gzip: 0 };

    const baselineData = {
      timestamp: new Date().toISOString(),
      stage: 'stage-0-orient',
      branch: 'landing-v3',
      metrics: {
        desktop: desktopMetrics,
        mobile: mobileMetrics,
      },
      bundles: {
        indexHtml: indexHtmlSize,
        totalClientJs: { raw: totalClientJsRaw, gzip: totalClientJsGzip },
        totalClientCss: { raw: totalClientCssRaw, gzip: totalClientCssGzip },
      },
      assetSizes,
    };

    fs.writeFileSync(BASELINE_JSON, JSON.stringify(baselineData, null, 2));
    fs.writeFileSync(path.join(BEFORE_DIR, 'baseline.json'), JSON.stringify(baselineData, null, 2));
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'landing-v3-baseline.json'), JSON.stringify(baselineData, null, 2));
    }

    console.log('Stage 0 completed successfully!');
    console.log(`Baseline recorded to: ${BASELINE_JSON}`);
    console.log(`Screenshots saved to: ${BEFORE_DIR}`);
    console.log('Mobile Metrics:', mobileMetrics);
    console.log('Desktop Metrics:', desktopMetrics);
    console.log('Client JS Gzip:', Math.round(totalClientJsGzip / 1024), 'KB');
    console.log('Client CSS Gzip:', Math.round(totalClientCssGzip / 1024), 'KB');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
