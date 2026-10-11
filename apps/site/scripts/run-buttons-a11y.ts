// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/run-buttons-a11y.ts
//
// Runs Axe accessibility audit specifically on the button system specimen matrix
// across Dark and Light themes.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4336;
const DIST_DIR = path.resolve(__dirname, '../dist');

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
  let totalViolations = 0;

  try {
    const targetUrl = fs.existsSync(path.join(DIST_DIR, 'dev/styleguide/buttons/index.html'))
      ? `http://127.0.0.1:${PORT}/dev/styleguide/buttons/`
      : `http://127.0.0.1:${PORT}/`;

    const themes: ('dark' | 'light')[] = ['dark', 'light'];

    for (const theme of themes) {
      console.log(`Running Button System Axe audit in ${theme.toUpperCase()} theme...`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: theme,
      });

      const page = await context.newPage();
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);

      await page.waitForTimeout(200);

      const results = await new AxeBuilder({ page })
        .include('.btn, .btn-group, .segmented-control, .btn-tooltip')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (seriousOrCritical.length > 0) {
        console.error(
          `\n❌ Found ${seriousOrCritical.length} serious/critical accessibility violations in ${theme}:`,
        );
        for (const v of seriousOrCritical) {
          console.error(`  • [${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
          for (const node of v.nodes.slice(0, 3)) {
            console.error(`      Target: ${node.target}`);
            console.error(`      Failure: ${node.failureSummary}`);
          }
        }
        totalViolations += seriousOrCritical.length;
      } else {
        console.log(`  ✓ Passed: 0 serious or critical violations in ${theme} theme.`);
      }

      await context.close();
    }

    if (totalViolations > 0) {
      process.exit(1);
    } else {
      console.log('\nAll button system accessibility audits passed.');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
