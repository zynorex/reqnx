// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/measure-landing-v3.ts
//
// Measures Landing v3 performance metrics on static dist/ build:
// - LCP, CLS, FCP, DOMContentLoaded, Load time via Chromium Performance Observer
// - Gzip asset bundle sizes and total payload
// - Writes results to docs/site/landing-v3-measured.json
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4349;
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DIST_DIR = path.resolve(__dirname, '../dist');
const OUTPUT_FILE = path.resolve(REPO_ROOT, 'docs/site/landing-v3-measured.json');

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
      resolve(server);
    });
  });
}

function getGzipSize(filePath: string): { raw: number; gzip: number } {
  const content = fs.readFileSync(filePath);
  const gzip = zlib.gzipSync(content);
  return {
    raw: content.length,
    gzip: gzip.length,
  };
}

async function measureMetrics(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({
    viewport: { width, height },
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    (window as unknown as { __clsScore: number }).__clsScore = 0;
    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const shiftEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shiftEntry.hadRecentInput && typeof shiftEntry.value === 'number') {
            (window as unknown as { __clsScore: number }).__clsScore += shiftEntry.value;
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
  await page.evaluate(() => window.scrollTo(0, 800));
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
    console.log('Measuring Landing v3 performance metrics...');
    const desktopMetrics = await measureMetrics(browser, 1440, 900);
    const mobileMetrics = await measureMetrics(browser, 390, 844);

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

    const indexHtmlPath = path.join(DIST_DIR, 'index.html');
    const indexHtmlSize = fs.existsSync(indexHtmlPath) ? getGzipSize(indexHtmlPath) : { raw: 0, gzip: 0 };

    const measuredData = {
      timestamp: new Date().toISOString(),
      stage: 'stage-5-measured',
      branch: 'landing-v3',
      metrics: {
        desktop: desktopMetrics,
        mobile: mobileMetrics,
      },
      bundles: {
        indexHtml: indexHtmlSize,
        totalClientJs: {
          raw: totalClientJsRaw,
          gzip: totalClientJsGzip,
        },
        totalClientCss: {
          raw: totalClientCssRaw,
          gzip: totalClientCssGzip,
        },
      },
      assetSizes,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(measuredData, null, 2));
    console.log(`Measured data written to ${OUTPUT_FILE}`);
    console.log('Desktop Metrics:', desktopMetrics);
    console.log('Mobile Metrics:', mobileMetrics);
    console.log(`Index HTML: ${indexHtmlSize.raw} B (gzip: ${indexHtmlSize.gzip} B)`);
    console.log(`Total Client JS: ${totalClientJsRaw} B (gzip: ${totalClientJsGzip} B)`);
    console.log(`Total Client CSS: ${totalClientCssRaw} B (gzip: ${totalClientCssGzip} B)`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
