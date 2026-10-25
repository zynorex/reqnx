// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/lint-source-buttons.ts
//
// Fails on raw <button> tags outside approved primitive definitions or ARIA tabs.
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

// Components allowed to render native <button>
const ALLOWED_COMPONENTS = new Set([
  'Button.astro',
  'Button.tsx',
  'IconButton.astro',
  'IconButton.tsx',
  'ToggleButton.tsx',
  'CopyButton.tsx',
  'CopyMarkdownButton.tsx',
  'MotionControl.astro',
  'ThemeToggle.tsx',
  'Header.astro',
  'MobileSheet.astro',
  'NavFlyout.astro',
]);

export interface SourceLintResult {
  file: string;
  line: number;
  snippet: string;
  message: string;
}

export function lintSourceFile(filePath: string, content: string): SourceLintResult[] {
  const base = path.basename(filePath);
  if (ALLOWED_COMPONENTS.has(base)) {
    return [];
  }

  const results: SourceLintResult[] = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for raw lowercase <button HTML tag
    if (/<button\b/.test(line)) {
      // Look ahead to capture full multi-line tag
      let fullTag = line;
      let offset = 1;
      while (!fullTag.includes('>') && idx + offset < lines.length) {
        fullTag += ' ' + lines[idx + offset];
        offset++;
      }

      // Allowed if it explicitly has role="tab"
      if (fullTag.includes('role="tab"') || fullTag.includes("role='tab'")) {
        return;
      }

      // Allowed in Header.astro for menu toggle with .btn class
      if (base === 'Header.astro' && fullTag.includes('rx-menu-toggle')) {
        return;
      }

      // Skip internal dev motion lab
      if (filePath.replace(/\\/g, '/').includes('/pages/dev/motion/')) {
        return;
      }

      results.push({
        file: filePath,
        line: idx + 1,
        snippet: line.trim(),
        message: 'Raw <button> tag detected outside button primitives. Use <Button> or <IconButton>.',
      });
    }

    // Check for role="button" on anchors
    if (/<a\b[^>]*role=['"]button['"]/i.test(line)) {
      results.push({
        file: filePath,
        line: idx + 1,
        snippet: line.trim(),
        message: 'Forbidden role="button" on <a> anchor. Use <Button href="...">.',
      });
    }

    // Check for href="#"
    if (/<a\b[^>]*href=['"]#['"]/i.test(line)) {
      results.push({
        file: filePath,
        line: idx + 1,
        snippet: line.trim(),
        message: 'Forbidden href="#" on anchor. Use a semantic <button> instead of fake link.',
      });
    }
  });

  return results;
}

function scanDir(dir: string, results: SourceLintResult[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.astro') {
        scanDir(fullPath, results);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.astro') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      results.push(...lintSourceFile(fullPath, content));
    }
  }
}

export function runSourceLint(): { passed: boolean; violations: SourceLintResult[] } {
  const violations: SourceLintResult[] = [];
  scanDir(SRC_DIR, violations);
  return {
    passed: violations.length === 0,
    violations,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { passed, violations } = runSourceLint();
  if (!passed) {
    console.error(`❌ Found ${violations.length} source button lint violations:`);
    for (const v of violations) {
      console.error(`  ${path.relative(SRC_DIR, v.file)}:${v.line} - ${v.message}\n    ${v.snippet}`);
    }
    process.exit(1);
  } else {
    console.log('✓ Source button lint passed: No unapproved raw buttons or fake anchors.');
  }
}
