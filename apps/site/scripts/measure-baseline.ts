// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/measure-baseline.ts
//
// Measures baseline performance metrics on static dist/ build:
// - LCP, CLS, FCP, TBT via Chromium Performance Observer
// - Gzip asset bundle sizes
// - Emits docs/site/motion-baseline.json
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4344;
const DIST_DIR = path.resolve(__dirname, '../dist');
const OUTPUT_FILE = path.resolve(__dirname, '../../../docs/site/motion-baseline.json');

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

    server.listen(PORT, () => resolve(server));
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

async function run() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Measure bundle sizes
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

    const indexHtmlSize = getGzipSize(path.join(DIST_DIR, 'index.html'));
    const notFoundHtmlSize = getGzipSize(path.join(DIST_DIR, '404.html'));

    // 2. Measure Web Vitals in Mobile Profile (390x844)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // Inject performance observer before navigation
    await page.addInitScript(() => {
      (window as any).__metrics = {
        fcp: 0,
        lcp: 0,
        cls: 0,
        tbt: 0,
        longTasks: [] as number[],
      };

      try {
        // Paint (FCP)
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              (window as any).__metrics.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });

        // LCP
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            (window as any).__metrics.lcp = entries[entries.length - 1].startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // CLS
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              (window as any).__metrics.cls += entry.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });

        // Long Tasks -> TBT approximation
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const blockingTime = Math.max(0, entry.duration - 50);
            (window as any).__metrics.tbt += blockingTime;
            (window as any).__metrics.longTasks.push(entry.duration);
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch (e) {
        // Fallback if some observer type unsupported
      }
    });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    // Allow any hero animations / initial island ticks to settle
    await page.waitForTimeout(2000);

    const metrics = await page.evaluate(() => (window as any).__metrics);

    const baselineData = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        browser: 'Chromium (Playwright Mobile 390x844)',
        viewport: '390x844 @2x',
      },
      lighthouseNote:
        'Measured via Chromium PerformanceObserver in Playwright mobile emulation profile (Lighthouse standalone requires Chrome debugging protocol server or CLI; metrics below reflect Chromium CDP web-vitals equivalents).',
      webVitalsMobile: {
        fcpMs: Math.round(metrics.fcp),
        lcpMs: Math.round(metrics.lcp),
        cls: Number(metrics.cls.toFixed(4)),
        tbtMs: Math.round(metrics.tbt),
        longTaskCount: metrics.longTasks.length,
      },
      bundleSizes: {
        indexHtml: {
          rawBytes: indexHtmlSize.raw,
          gzipBytes: indexHtmlSize.gzip,
        },
        notFoundHtml: {
          rawBytes: notFoundHtmlSize.raw,
          gzipBytes: notFoundHtmlSize.gzip,
        },
        totalClientJs: {
          rawBytes: totalClientJsRaw,
          gzipBytes: totalClientJsGzip,
        },
        totalClientCss: {
          rawBytes: totalClientCssRaw,
          gzipBytes: totalClientCssGzip,
        },
        chunks: assetSizes,
      },
      budgets: {
        maxMotionJsGzipBytes: 6144, // 6 KB
        maxMotionCssGzipBytes: 5120, // 5 KB
        maxLcpDeltaMs: 50,
        maxCls: 0.02,
        maxTbtMs: 20,
      },
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(baselineData, null, 2), 'utf-8');
    console.log(`Baseline recorded to ${OUTPUT_FILE}`);
    console.log(JSON.stringify(baselineData.webVitalsMobile, null, 2));
    console.log(`Landing Page JS (gzip): ${totalClientJsGzip} bytes`);
    console.log(`Landing Page CSS (gzip): ${totalClientCssGzip} bytes`);
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
