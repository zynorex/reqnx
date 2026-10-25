// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/lint-css-buttons.ts
//
// Fails if raw button or button-like selectors appear outside buttons.css.
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STYLES_DIR = path.resolve(__dirname, '../src/styles');

export interface CssLintResult {
  file: string;
  line: number;
  selector: string;
  message: string;
}

export function lintCssContent(filename: string, content: string): CssLintResult[] {
  const isButtonsCss = path.basename(filename) === 'buttons.css';
  if (isButtonsCss) return [];

  const results: CssLintResult[] = [];
  const lines = content.split('\n');

  // Forbidden patterns outside buttons.css:
  // - raw `button` selector or `button:`
  // - `[role="button"]`
  // - `.btn-` or `.button-` legacy ad-hoc classes
  const forbiddenRegex = /(?:^|[,\s{])(?:button\b|\[role=['"]button['"]\]|\.rx-btn(?:--[a-z]+|-primary|-secondary|-outline|-ghost)\b)/;

  lines.forEach((line, idx) => {
    // Skip comments and properties
    const trimmed = line.trim();
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) {
      return;
    }
    // Skip third-party vendor overrides (e.g. Starlight Expressive Code copy button)
    if (trimmed.includes('.expressive-code')) {
      return;
    }
    // Skip property declarations (lines without opening brace, e.g. color: red;)
    if (trimmed.includes(':') && !trimmed.includes('{') && !trimmed.includes('button')) {
      return;
    }

    if (forbiddenRegex.test(line)) {
      results.push({
        file: filename,
        line: idx + 1,
        selector: trimmed,
        message: 'Forbidden ad-hoc button styling outside buttons.css',
      });
    }
  });

  return results;
}

export function runCssLint(): { passed: boolean; violations: CssLintResult[] } {
  const cssFiles = fs.readdirSync(STYLES_DIR).filter((f) => f.endsWith('.css'));
  const allViolations: CssLintResult[] = [];

  for (const file of cssFiles) {
    const fullPath = path.join(STYLES_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const violations = lintCssContent(fullPath, content);
    allViolations.push(...violations);
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { passed, violations } = runCssLint();
  if (!passed) {
    console.error(`❌ Found ${violations.length} CSS button lint violations:`);
    for (const v of violations) {
      console.error(`  ${path.basename(v.file)}:${v.line} - ${v.message} (${v.selector})`);
    }
    process.exit(1);
  } else {
    console.log('✓ CSS button lint passed: All button styles reside in buttons.css.');
  }
}
