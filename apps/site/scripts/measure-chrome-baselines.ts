// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/measure-chrome-baselines.ts
//
// Stage 0: Measure baseline metrics for site chrome:
// - JS & CSS size of current header and footer
// - Cumulative Layout Shift (CLS) on landing and docs
// - Core Web Vitals / performance baseline
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4345;
const DIST_DIR = path.resolve(__dirname, '../dist');
const OUTPUT_FILE = path.resolve(__dirname, '../../../docs/site/chrome-baselines.json');
const REPORT_FILE = path.resolve(__dirname, '../../../docs/site/chrome-baselines.md');

function startStaticServer(): Promise<http.Server> {
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
      if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
        filePath = path.join(filePath, 'index.html');
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

function getFileSizes(filePath: string): { raw: number; gzip: number } {
  if (!fs.existsSync(filePath)) return { raw: 0, gzip: 0 };
  const content = fs.readFileSync(filePath);
  return {
    raw: content.length,
    gzip: gzipSync(content).length,
  };
}

async function measurePagePerformance(url: string, width = 1440, height = 900) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  // Inject CLS observer before script execution
  await page.addInitScript(() => {
    (window as any).__clsScore = 0;
    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).__clsScore += (entry as any).value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });

  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  const loadDurationMs = Date.now() - startTime;

  // Scroll down and back up to evaluate scroll-induced layout shift
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime ?? 0;
    return {
      cls: (window as any).__clsScore ?? 0,
      fcp: Math.round(fcp),
      domContentLoaded: Math.round(timing?.domContentLoadedEventEnd ?? 0),
      load: Math.round(timing?.loadEventEnd ?? 0),
    };
  });

  await browser.close();
  return {
    ...metrics,
    totalWallClockMs: loadDurationMs,
  };
}

async function main() {
  const server = await startStaticServer();

  try {
    console.log('Measuring performance on Landing and Docs pages...');
    const landingMetrics = await measurePagePerformance(`http://127.0.0.1:${PORT}/`);
    const docsMetrics = await measurePagePerformance(`http://127.0.0.1:${PORT}/getting-started/`);

    // Measure chrome source assets and dist chunks
    const astroDir = path.join(DIST_DIR, '_astro');
    const distFiles = fs.existsSync(astroDir) ? fs.readdirSync(astroDir) : [];

    const headerJsFile = distFiles.find((f) => f.startsWith('Header.astro_astro_type_script') && f.endsWith('.js'));
    const footerJsFile = distFiles.find((f) => f.startsWith('Footer.astro_astro_type_script') && f.endsWith('.js'));
    const themeJsFile = distFiles.find((f) => f.startsWith('ThemeToggle') && f.endsWith('.js'));

    const headerJsSize = headerJsFile ? getFileSizes(path.join(astroDir, headerJsFile)) : { raw: 0, gzip: 0 };
    const footerJsSize = footerJsFile ? getFileSizes(path.join(astroDir, footerJsFile)) : { raw: 0, gzip: 0 };
    const themeJsSize = themeJsFile ? getFileSizes(path.join(astroDir, themeJsFile)) : { raw: 0, gzip: 0 };

    const headerAstroSize = getFileSizes(path.resolve(__dirname, '../src/components/landing/Header.astro'));
    const footerAstroSize = getFileSizes(path.resolve(__dirname, '../src/components/landing/Footer.astro'));
    const buttonsCssSize = getFileSizes(path.resolve(__dirname, '../src/styles/buttons.css'));
    const docsThemeCssSize = getFileSizes(path.resolve(__dirname, '../src/styles/docs-theme.css'));
    const globalCssSize = getFileSizes(path.resolve(__dirname, '../src/styles/global.css'));

    const baselineData = {
      timestamp: new Date().toISOString(),
      performance: {
        landing: landingMetrics,
        docs: docsMetrics,
      },
      sizes: {
        runtimeJs: {
          headerJs: headerJsSize,
          footerJs: footerJsSize,
          themeToggleJs: themeJsSize,
          totalChromeJsGzip: headerJsSize.gzip + footerJsSize.gzip + themeJsSize.gzip,
        },
        sourceStylesAndComponents: {
          headerAstro: headerAstroSize,
          footerAstro: footerAstroSize,
          buttonsCss: buttonsCssSize,
          docsThemeCss: docsThemeCssSize,
          globalCss: globalCssSize,
        },
      },
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(baselineData, null, 2));

    const markdownReport = `# Stage 0 Chrome Baseline Metrics

**Date:** ${new Date().toISOString()}
**Git Branch:** \`chrome-ui\`

## 1. Core Web Vitals & Ergonomic Performance

| Page | CLS (Cumulative Layout Shift) | FCP (First Contentful Paint) | DOMContentLoaded | Total Wall Clock |
| :--- | :---: | :---: | :---: | :---: |
| **Landing (\`/\`)** | **${landingMetrics.cls.toFixed(4)}** | ${landingMetrics.fcp} ms | ${landingMetrics.domContentLoaded} ms | ${landingMetrics.totalWallClockMs} ms |
| **Docs (\`/getting-started/\`)** | **${docsMetrics.cls.toFixed(4)}** | ${docsMetrics.fcp} ms | ${docsMetrics.domContentLoaded} ms | ${docsMetrics.totalWallClockMs} ms |

*Note: CLS target for the new chrome is 0. Current landing is ${landingMetrics.cls.toFixed(4)}, docs is ${docsMetrics.cls.toFixed(4)}.*

## 2. Chrome JavaScript & CSS Sizes

### Client JavaScript (Gzip)
- **Header Script (\`Header.astro\`):** ${(headerJsSize.raw / 1024).toFixed(2)} kB (${(headerJsSize.gzip / 1024).toFixed(2)} kB gzip)
- **Footer Script (\`Footer.astro\`):** ${(footerJsSize.raw / 1024).toFixed(2)} kB (${(footerJsSize.gzip / 1024).toFixed(2)} kB gzip)
- **Theme Toggle Island (\`ThemeToggle.tsx\`):** ${(themeJsSize.raw / 1024).toFixed(2)} kB (${(themeJsSize.gzip / 1024).toFixed(2)} kB gzip)
- **Total Chrome JS (Gzip):** **${((headerJsSize.gzip + footerJsSize.gzip + themeJsSize.gzip) / 1024).toFixed(2)} kB** *(Budget limit: 2.0 kB gzip)*

### Stylesheets (Source & Shared)
- **Buttons System (\`buttons.css\`):** ${(buttonsCssSize.raw / 1024).toFixed(2)} kB (${(buttonsCssSize.gzip / 1024).toFixed(2)} kB gzip)
- **Docs Theme (\`docs-theme.css\`):** ${(docsThemeCssSize.raw / 1024).toFixed(2)} kB (${(docsThemeCssSize.gzip / 1024).toFixed(2)} kB gzip)
- **Global Tokens & Theme (\`global.css\`):** ${(globalCssSize.raw / 1024).toFixed(2)} kB (${(globalCssSize.gzip / 1024).toFixed(2)} kB gzip)

## 3. Visual Review Baseline
- **Captured Screenshots:** 50 screenshots spanning landing (top & scrolled), docs, 404, playground, across 1440, 1024, 768, 390px, light and dark modes, plus mobile drawer open, hover, and focus states.
- **Location:** \`.shots/chrome/before/\`
- **Contact Sheet:** \`.shots/chrome/before/index.html\`
`;

    fs.writeFileSync(REPORT_FILE, markdownReport);
    console.log(`Baseline recorded to ${REPORT_FILE}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
