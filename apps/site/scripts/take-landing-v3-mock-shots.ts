// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/take-landing-v3-mock-shots.ts
//
// Captures review screenshots of Landing v3 static mocks:
// - Option B (Dark Stage, Recommended) at 1440 and 390 in Dark and Light
// - Option A (Voltage Canvas) at 1440 in Dark and Light
// - Option C (Quiet Canvas) at 1440 in Dark and Light
// - Saves to .shots/landing-v3/mocks/ and copies to artifacts
// ──────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4366;
const REPO_ROOT = path.resolve(__dirname, '../../..');
const MOCKS_DIR = path.resolve(REPO_ROOT, 'docs/site/design/landing-v3-mocks');
const SHOTS_DIR = path.resolve(REPO_ROOT, '.shots/landing-v3/mocks');
const ARTIFACTS_DIR = 'C:\\Users\\AYUSH\\.gemini\\antigravity-ide\\brain\\4ee76cb5-b58c-4f12-bc1e-749c78d64cd1';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

function startServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url ? req.url.split('?')[0] : '/';
      if (reqPath === '/' || reqPath.endsWith('/')) {
        reqPath += 'index.html';
      }
      const filePath = path.join(MOCKS_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

interface MockShot {
  name: string;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  option: 'option-a' | 'option-b' | 'option-c';
  vp: '1440' | '390';
}

const SHOTS: MockShot[] = [
  // Option B: Dark Stage (Recommended)
  { name: 'mock-option-b-1440-dark', width: 1440, height: 900, theme: 'dark', option: 'option-b', vp: '1440' },
  { name: 'mock-option-b-1440-light', width: 1440, height: 900, theme: 'light', option: 'option-b', vp: '1440' },
  { name: 'mock-option-b-390-dark', width: 440, height: 844, theme: 'dark', option: 'option-b', vp: '390' },
  { name: 'mock-option-b-390-light', width: 440, height: 844, theme: 'light', option: 'option-b', vp: '390' },

  // Option A: Voltage Canvas
  { name: 'mock-option-a-1440-dark', width: 1440, height: 900, theme: 'dark', option: 'option-a', vp: '1440' },
  { name: 'mock-option-a-1440-light', width: 1440, height: 900, theme: 'light', option: 'option-a', vp: '1440' },

  // Option C: Quiet Canvas
  { name: 'mock-option-c-1440-dark', width: 1440, height: 900, theme: 'dark', option: 'option-c', vp: '1440' },
  { name: 'mock-option-c-1440-light', width: 1440, height: 900, theme: 'light', option: 'option-c', vp: '1440' },
];

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    console.log('Capturing Landing v3 Mock Review Screenshots...');
    for (const shot of SHOTS) {
      process.stdout.write(`Capturing ${shot.name}... `);
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        colorScheme: shot.theme,
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle' });

      await page.evaluate(
        ({ th, opt, vp }) => {
          document.documentElement.setAttribute('data-theme', th);
          document.documentElement.setAttribute('data-option', opt);
          const frame = document.getElementById('frame');
          if (frame) frame.setAttribute('data-vp', vp);
        },
        { th: shot.theme, opt: shot.option, vp: shot.vp }
      );

      await page.waitForTimeout(200);

      const filePath = path.join(SHOTS_DIR, `${shot.name}.png`);
      // Capture top hero area (first 1000px)
      await page.screenshot({ path: filePath, clip: { x: 0, y: 50, width: shot.width, height: 950 } });

      if (fs.existsSync(ARTIFACTS_DIR)) {
        try {
          fs.copyFileSync(filePath, path.join(ARTIFACTS_DIR, `${shot.name}.png`));
        } catch {}
      }

      console.log('Done.');
      await context.close();
    }

    console.log(`All mock screenshots captured and saved to ${SHOTS_DIR}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(console.error);
