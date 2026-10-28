// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/measure-mobile-baselines.ts
//
// Stage 0 Mobile Baseline Measurement Script:
// 1. Throttled Playwright runs (LCP, FCP, CLS, TBT, Interaction Latency on Send request)
// 2. JS & CSS asset byte sizes per page type
// 3. Tap-target audit (< 44x44px, spacing < 8px)
// 4. Horizontal overflow audit (320px to 480px)
// 5. Emits docs/site/mobile-baselines.json and docs/site/mobile-baselines.md
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium, type CDPSession } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4350;
const DIST_DIR = path.resolve(__dirname, '../dist');
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BASELINES_JSON = path.resolve(REPO_ROOT, 'docs/site/mobile-baselines.json');
const BASELINES_MD = path.resolve(REPO_ROOT, 'docs/site/mobile-baselines.md');

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

function getFileSize(filePath: string): { raw: number; gzip: number } {
  if (!fs.existsSync(filePath)) return { raw: 0, gzip: 0 };
  const content = fs.readFileSync(filePath);
  return {
    raw: content.length,
    gzip: zlib.gzipSync(content).length,
  };
}

interface PageAssetMetrics {
  pageUrl: string;
  html: { raw: number; gzip: number };
  js: { raw: number; gzip: number; files: number };
  css: { raw: number; gzip: number; files: number };
}

function measureAssetSizes(pageUrl: string): PageAssetMetrics {
  let relPath = pageUrl.replace(/^\//, '');
  if (relPath === '' || relPath.endsWith('/')) {
    relPath += 'index.html';
  } else if (!relPath.endsWith('.html')) {
    relPath += '/index.html';
  }

  const htmlPath = path.join(DIST_DIR, relPath);
  const htmlSize = getFileSize(htmlPath);

  if (!fs.existsSync(htmlPath)) {
    return {
      pageUrl,
      html: htmlSize,
      js: { raw: 0, gzip: 0, files: 0 },
      css: { raw: 0, gzip: 0, files: 0 },
    };
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Match scripts and stylesheets
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g;

  let jsRaw = 0;
  let jsGzip = 0;
  let jsCount = 0;

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const src = match[1].split('?')[0];
    const assetPath = path.join(DIST_DIR, src.startsWith('/') ? src.slice(1) : src);
    if (fs.existsSync(assetPath)) {
      const s = getFileSize(assetPath);
      jsRaw += s.raw;
      jsGzip += s.gzip;
      jsCount++;
    }
  }

  let cssRaw = 0;
  let cssGzip = 0;
  let cssCount = 0;

  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1].split('?')[0];
    const assetPath = path.join(DIST_DIR, href.startsWith('/') ? href.slice(1) : href);
    if (fs.existsSync(assetPath)) {
      const s = getFileSize(assetPath);
      cssRaw += s.raw;
      cssGzip += s.gzip;
      cssCount++;
    }
  }

  return {
    pageUrl,
    html: htmlSize,
    js: { raw: jsRaw, gzip: jsGzip, files: jsCount },
    css: { raw: cssRaw, gzip: cssGzip, files: cssCount },
  };
}

interface WebVitalsMetrics {
  lcp: number;
  fcp: number;
  cls: number;
  tbt: number;
  longTaskCount: number;
  interactionLatencyMs: number | null;
}

async function measureThrottledVitals(
  url: string,
  width: number,
  height: number,
  cpuSlowdown = 4,
): Promise<WebVitalsMetrics> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();
  const client: CDPSession = await context.newCDPSession(page);

  // CPU throttling
  await client.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });

  // Network throttling: Slow 4G profile (1.6 Mbps down, 750 kbps up, 150 ms latency)
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  // Inject observers for LCP, FCP, CLS, Long Tasks
  await page.addInitScript(() => {
    (window as any).__vitals = {
      fcp: 0,
      lcp: 0,
      cls: 0,
      tbt: 0,
      longTaskCount: 0,
    };

    try {
      // Paint observer
      const paintObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            (window as any).__vitals.fcp = entry.startTime;
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });

      // LCP observer
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          (window as any).__vitals.lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // CLS observer
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const shiftEntry = entry as any;
          if (!shiftEntry.hadRecentInput && typeof shiftEntry.value === 'number') {
            (window as any).__vitals.cls += shiftEntry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // Long Tasks observer (TBT proxy)
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          (window as any).__vitals.longTaskCount++;
          const blockingTime = entry.duration - 50;
          if (blockingTime > 0) {
            (window as any).__vitals.tbt += blockingTime;
          }
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {}
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // Measure interaction latency on "Send request" button if on landing
  let interactionLatencyMs: number | null = null;
  const sendButton = page.locator('#rx-hero-send-btn, button:has-text("Send request")').first();
  if (await sendButton.isVisible()) {
    const startTime = Date.now();
    await sendButton.click();
    await page.waitForTimeout(50);
    const latency = Date.now() - startTime;
    interactionLatencyMs = latency;
  }

  const vitals = await page.evaluate(() => {
    return (window as any).__vitals as {
      fcp: number;
      lcp: number;
      cls: number;
      tbt: number;
      longTaskCount: number;
    };
  });

  await browser.close();

  return {
    lcp: Math.round(vitals.lcp || 0),
    fcp: Math.round(vitals.fcp || 0),
    cls: Number(vitals.cls.toFixed(4)),
    tbt: Math.round(vitals.tbt || 0),
    longTaskCount: vitals.longTaskCount,
    interactionLatencyMs,
  };
}

interface TapTargetViolation {
  element: string;
  text: string;
  width: number;
  height: number;
  spacingViolations: Array<{ nearby: string; distancePx: number }>;
}

async function auditTapTargets(
  url: string,
  width = 390,
  height = 844,
): Promise<{ totalTargets: number; violations: TapTargetViolation[] }> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('a, button, input, select, textarea, [role="button"], summary'),
    );

    const interactive = candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
      );
    });

    const violations: Array<{
      element: string;
      text: string;
      width: number;
      height: number;
      spacingViolations: Array<{ nearby: string; distancePx: number }>;
    }> = [];

    for (let i = 0; i < interactive.length; i++) {
      const el = interactive[i];
      const rect = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().slice(0, 30);
      const isTooSmall = rect.width < 44 || rect.height < 44;

      // Check distance to closest interactive neighbour
      const spacingViolations: Array<{ nearby: string; distancePx: number }> = [];
      for (let j = 0; j < interactive.length; j++) {
        if (i === j) continue;
        const other = interactive[j];
        const otherRect = other.getBoundingClientRect();

        // Check horizontal & vertical gap
        const xDist = Math.max(0, Math.max(rect.left - otherRect.right, otherRect.left - rect.right));
        const yDist = Math.max(0, Math.max(rect.top - otherRect.bottom, otherRect.top - rect.bottom));
        const dist = Math.hypot(xDist, yDist);

        if (dist < 8 && dist > 0) {
          spacingViolations.push({
            nearby: `${other.tagName.toLowerCase()} ("${(other.textContent || '').trim().slice(0, 20)}")`,
            distancePx: Math.round(dist),
          });
        }
      }

      if (isTooSmall || spacingViolations.length > 0) {
        violations.push({
          element: `<${tag}${el.className ? ` class="${el.className.slice(0, 30)}"` : ''}>`,
          text,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          spacingViolations: spacingViolations.slice(0, 2),
        });
      }
    }

    return {
      totalTargets: interactive.length,
      violations,
    };
  });

  await browser.close();
  return result;
}

interface OverflowCheckResult {
  width: number;
  hasOverflow: boolean;
  scrollWidth: number;
  offendingElements: string[];
}

async function checkHorizontalOverflow(url: string, widths: number[]): Promise<OverflowCheckResult[]> {
  const browser = await chromium.launch();
  const results: OverflowCheckResult[] = [];

  for (const w of widths) {
    const context = await browser.newContext({
      viewport: { width: w, height: 800 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    const check = await page.evaluate((viewportWidth) => {
      const scrollW = document.documentElement.scrollWidth;
      const docW = window.innerWidth;
      const hasOverflow = scrollW > docW;

      const offending: string[] = [];
      if (hasOverflow) {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const r = el.getBoundingClientRect();
          if (r.right > docW + 1) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
            offending.push(`${tag}${id}${cls} (right: ${Math.round(r.right)}px vs ${docW}px)`);
          }
        }
      }

      return {
        hasOverflow,
        scrollWidth: scrollW,
        offendingElements: offending.slice(0, 5),
      };
    }, w);

    results.push({
      width: w,
      hasOverflow: check.hasOverflow,
      scrollWidth: check.scrollWidth,
      offendingElements: check.offendingElements,
    });

    await context.close();
  }

  await browser.close();
  return results;
}

async function main() {
  console.log('--- Starting Stage 0 Mobile Baseline Measurements ---');
  const server = await startStaticServer();

  try {
    const pages = ['/', '/getting-started/', '/design/architecture/', '/playground/', '/404/'];

    // 1. Asset Sizes
    console.log('\n[1/4] Measuring JS and CSS asset sizes per page...');
    const assetSizes: PageAssetMetrics[] = [];
    for (const p of pages) {
      const sizes = measureAssetSizes(p);
      assetSizes.push(sizes);
      console.log(`  ${p.padEnd(24)} HTML: ${(sizes.html.raw / 1024).toFixed(1)}KB (${(sizes.html.gzip / 1024).toFixed(1)}KB gzip) | JS: ${(sizes.js.raw / 1024).toFixed(1)}KB (${(sizes.js.gzip / 1024).toFixed(1)}KB gzip) | CSS: ${(sizes.css.raw / 1024).toFixed(1)}KB (${(sizes.css.gzip / 1024).toFixed(1)}KB gzip)`);
    }

    // 2. Throttled Web Vitals
    console.log('\n[2/4] Measuring Web Vitals under CPU 4x slowdown & Slow 4G network (360x800)...');
    const vitalsData: Record<string, WebVitalsMetrics> = {};
    for (const p of ['/', '/getting-started/', '/playground/']) {
      const url = `http://127.0.0.1:${PORT}${p}`;
      console.log(`  Sampling ${p}...`);
      const v = await measureThrottledVitals(url, 360, 800, 4);
      vitalsData[p] = v;
      console.log(`    LCP: ${v.lcp}ms | FCP: ${v.fcp}ms | CLS: ${v.cls} | TBT: ${v.tbt}ms | Latency: ${v.interactionLatencyMs ?? 'N/A'}ms`);
    }

    // 3. Tap-target Audit
    console.log('\n[3/4] Auditing tap targets (< 44x44px or spacing < 8px) on 390x844...');
    const tapTargetData: Record<string, { totalTargets: number; violationCount: number; sampleViolations: TapTargetViolation[] }> = {};
    for (const p of pages) {
      const url = `http://127.0.0.1:${PORT}${p}`;
      const res = await auditTapTargets(url, 390, 844);
      tapTargetData[p] = {
        totalTargets: res.totalTargets,
        violationCount: res.violations.length,
        sampleViolations: res.violations.slice(0, 8),
      };
      console.log(`  ${p.padEnd(24)} Total targets: ${res.totalTargets} | Violations: ${res.violations.length} (${((res.violations.length / (res.totalTargets || 1)) * 100).toFixed(1)}%)`);
    }

    // 4. Horizontal Overflow Checks
    console.log('\n[4/4] Checking horizontal overflow across widths 320 to 480 px...');
    const overflowWidths = [320, 360, 375, 384, 390, 393, 414, 430, 480];
    const overflowData: Record<string, OverflowCheckResult[]> = {};
    for (const p of pages) {
      const url = `http://127.0.0.1:${PORT}${p}`;
      const res = await checkHorizontalOverflow(url, overflowWidths);
      overflowData[p] = res;
      const failing = res.filter((r) => r.hasOverflow);
      console.log(`  ${p.padEnd(24)} Failing widths: ${failing.length > 0 ? failing.map((f) => f.width + 'px').join(', ') : 'None (Clean)'}`);
    }

    // Compile Results Object
    const baselineResults = {
      timestamp: new Date().toISOString(),
      throttlingProfile: 'Chromium 360x800, 4x CPU slowdown, Slow 4G (150ms RTT, 1.6Mbps down, 750kbps up)',
      assets: assetSizes,
      vitals: vitalsData,
      tapTargets: tapTargetData,
      overflow: overflowData,
    };

    fs.writeFileSync(BASELINES_JSON, JSON.stringify(baselineResults, null, 2));

    // Generate Markdown Report
    const mdReport = `# Mobile Experience — Stage 0 Baseline Measurements

> Recorded on: \`${baselineResults.timestamp}\`
> Profile: Throttled mid-tier Android (Chromium 360x800, 4x CPU slowdown, Slow 4G network: 1.6 Mbps down, 750 kbps up, 150 ms RTT)

---

## 1. Asset Sizes per Page Type

| Page | HTML Raw / Gzip | JS Raw / Gzip | CSS Raw / Gzip | Total Gzip |
|:-----|:----------------|:--------------|:---------------|:-----------|
${assetSizes
  .map(
    (a) =>
      `| \`${a.pageUrl}\` | ${(a.html.raw / 1024).toFixed(1)} KB / **${(a.html.gzip / 1024).toFixed(1)} KB** | ${(a.js.raw / 1024).toFixed(1)} KB / **${(a.js.gzip / 1024).toFixed(1)} KB** (${a.js.files} scripts) | ${(a.css.raw / 1024).toFixed(1)} KB / **${(a.css.gzip / 1024).toFixed(1)} KB** (${a.css.files} sheets) | **${((a.html.gzip + a.js.gzip + a.css.gzip) / 1024).toFixed(1)} KB** |`,
  )
  .join('\n')}

- **Budget target for landing:** Initial JS gzip $\\le 35$ KB, all landing JS $\\le 60$ KB, CSS $\\le 30$ KB.
- Current landing JS gzip: **${(assetSizes[0].js.gzip / 1024).toFixed(1)} KB**, CSS gzip: **${(assetSizes[0].css.gzip / 1024).toFixed(1)} KB**.

---

## 2. Throttled Core Web Vitals (360x800, 4x CPU, Slow 4G)

| Page | LCP (Target $\\le 1.8$s) | FCP | CLS (Target $\\le 0.02$) | TBT (Target $\\le 100$ms) | Send Request Latency (Target $\\le 150$ms) |
|:-----|:------------------------|:----|:------------------------|:-------------------------|:-------------------------------------------|
${Object.entries(vitalsData)
  .map(
    ([p, v]) =>
      `| \`${p}\` | **${v.lcp} ms** | ${v.fcp} ms | **${v.cls}** | **${v.tbt} ms** (${v.longTaskCount} long tasks) | ${v.interactionLatencyMs ? `**${v.interactionLatencyMs} ms**` : 'N/A'} |`,
  )
  .join('\n')}

---

## 3. Tap-Target & Touch Geometry Audit (390x844)

Minimum target size rule: $\\ge 44\\times 44$ px, minimum spacing $\\ge 8$ px.

| Page | Total Interactive Targets | Violations (< 44px or < 8px spacing) | Violation Rate |
|:-----|:--------------------------|:------------------------------------|:---------------|
${Object.entries(tapTargetData)
  .map(
    ([p, t]) =>
      `| \`${p}\` | ${t.totalTargets} | **${t.violationCount}** | **${((t.violationCount / (t.totalTargets || 1)) * 100).toFixed(1)}%** |`,
  )
  .join('\n')}

### Notable Tap-Target Issues to Address in Flagship Mobile Redesign:
${Object.entries(tapTargetData)
  .flatMap(([p, t]) =>
    t.sampleViolations.slice(0, 3).map((v) => `- **${p}**: \`${v.element}\` ("${v.text}") measures **${v.width}×${v.height}px** (needs 44×44px)`),
  )
  .join('\n')}

---

## 4. Horizontal Overflow Audit (320px to 480px)

Rule: document.documentElement.scrollWidth <= window.innerWidth across all phone widths.

| Page | 320px | 360px | 375px | 384px | 390px | 393px | 414px | 430px | 480px |
|:-----|:------|:------|:------|:------|:------|:------|:------|:------|:------|
${Object.entries(overflowData)
  .map(([p, checks]) => {
    const cols = checks.map((c) => (c.hasOverflow ? `❌ (${c.scrollWidth}px)` : '✅ OK')).join(' | ');
    return `| \`${p}\` | ${cols} |`;
  })
  .join('\n')}

${Object.entries(overflowData)
  .filter(([_, checks]) => checks.some((c) => c.hasOverflow))
  .map(([p, checks]) => {
    const offending = checks.find((c) => c.hasOverflow)?.offendingElements.join(', ') ?? 'None';
    return `> ⚠️ **Overflow in ${p}**: Offending elements: ${offending}`;
  })
  .join('\n')}
`;

    fs.writeFileSync(BASELINES_MD, mdReport);
    console.log(`\nBaselines successfully saved to:\n  - ${BASELINES_JSON}\n  - ${BASELINES_MD}`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
