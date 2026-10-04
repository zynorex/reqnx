// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/run-a11y.ts
//
// Runs Axe core accessibility audit on the landing page in light and dark
// modes, across desktop and mobile viewports. Fails on serious or critical violations.
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const PORT = 4334;
const DIST_DIR = path.resolve(import.meta.dirname, '../dist');

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

interface AuditTarget {
  name: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
}

const TARGETS: AuditTarget[] = [
  { name: 'Desktop Dark', width: 1440, height: 900, theme: 'dark' },
  { name: 'Desktop Light', width: 1440, height: 900, theme: 'light' },
  { name: 'Mobile Dark', width: 390, height: 844, theme: 'dark' },
  { name: 'Mobile Light', width: 390, height: 844, theme: 'light' },
];

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  let totalViolations = 0;

  try {
    for (const target of TARGETS) {
      console.log(`Running Axe accessibility audit on ${target.name}...`);
      const context = await browser.newContext({
        viewport: { width: target.width, height: target.height },
        colorScheme: target.theme,
      });

      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });

      await page.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      }, target.theme);

      await page.waitForTimeout(300);

      // Run axe builder
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      if (seriousOrCritical.length > 0) {
        console.error(
          `\n❌ ${target.name} has ${seriousOrCritical.length} serious/critical violations:`,
        );
        for (const v of seriousOrCritical) {
          console.error(
            `  • [${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.nodes.length} occurrences)`,
          );
          for (const node of v.nodes.slice(0, 3)) {
            console.error(`      Target: ${node.target}`);
            console.error(`      Summary: ${node.failureSummary}`);
          }
        }
        totalViolations += seriousOrCritical.length;
      } else {
        console.log(
          `  ✓ Passed: 0 serious or critical violations (${results.passes.length} checks passed)`,
        );
      }

      await context.close();
    }

    if (totalViolations > 0) {
      process.exit(1);
    } else {
      console.log('\nAll accessibility audits passed with 0 serious or critical violations.');
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
