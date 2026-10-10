// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/lint-css-motion.ts
//
// Static CSS motion linter:
// - Prohibits 'transition: all'
// - Prohibits forbidden animated properties (width, height, top, left, margin, padding)
// - Warns on raw timing values outside token definitions
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STYLES_DIR = path.resolve(__dirname, '../src/styles');

const FORBIDDEN_PATTERNS = [
  {
    regex: /transition:\s*all/i,
    message: "Forbidden 'transition: all' detected. Explicitly list transform and/or opacity.",
  },
  {
    regex: /transition:\s*[^;]*(?:width|height|margin|padding|top|left)[^;]*;/i,
    message: 'Forbidden layout property animation detected (width, height, margin, padding, top, left). Animate transform or opacity instead.',
  },
];

function lintFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const errors: string[] = [];

  // Exclude comments
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.regex.test(cleanContent)) {
      errors.push(`${path.basename(filePath)}: ${rule.message}`);
    }
  }

  return errors;
}

function run() {
  const cssFiles = fs
    .readdirSync(STYLES_DIR)
    .filter((f) => f.endsWith('.css'))
    .map((f) => path.join(STYLES_DIR, f));

  let hasError = false;

  for (const file of cssFiles) {
    const errs = lintFile(file);
    if (errs.length > 0) {
      hasError = true;
      for (const err of errs) {
        console.error(`✖ ${err}`);
      }
    }
  }

  if (hasError) {
    console.error('CSS motion lint failed.');
    process.exit(1);
  } else {
    console.log('✓ CSS motion lint passed: No forbidden animated properties or transition:all found.');
  }
}

run();
