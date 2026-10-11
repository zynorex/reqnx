// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/lint-button-labels.ts
//
// Lints button labels against content guidelines:
// - Sentence case (no Title Case or ALL CAPS)
// - No "Click here"
// - No trailing punctuation (. or !)
// ──────────────────────────────────────────────────────────────────────────────

export interface LabelLintViolation {
  label: string;
  rule: string;
  message: string;
}

export function lintButtonLabel(label: string): LabelLintViolation[] {
  const violations: LabelLintViolation[] = [];
  const trimmed = label.trim();
  if (!trimmed) return [];

  // Check 1: No trailing punctuation
  if (/[.!?]$/.test(trimmed)) {
    violations.push({
      label: trimmed,
      rule: 'no-trailing-punctuation',
      message: 'Button label should not end with punctuation (! or .)',
    });
  }

  // Check 2: No "click here"
  if (/click here/i.test(trimmed)) {
    violations.push({
      label: trimmed,
      rule: 'no-click-here',
      message: 'Button label should be specific action verb, not "Click here"',
    });
  }

  // Check 3: No ALL CAPS (except acronyms like MIT, GitHub, ADR)
  const words = trimmed.split(/\s+/);
  const allowedAcronyms = new Set(['MIT', 'ADR', 'FAQ', 'API', 'HTTP', 'JSON']);
  const allCapsWords = words.filter(
    (w) => w.length > 2 && w === w.toUpperCase() && !allowedAcronyms.has(w),
  );
  if (allCapsWords.length > 0) {
    violations.push({
      label: trimmed,
      rule: 'no-all-caps',
      message: `Button label contains ALL CAPS words (${allCapsWords.join(', ')}). Use sentence case.`,
    });
  }

  return violations;
}

export function runLabelLint(): { passed: boolean; violations: { file: string; line: number; violation: LabelLintViolation }[] } {
  const violations: { file: string; line: number; violation: LabelLintViolation }[] = [];
  const srcDir = path.resolve(import.meta.dirname, '../src');

  function scan(dir: string) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== '.astro') {
        scan(full);
      } else if (ent.isFile() && (ent.name.endsWith('.astro') || ent.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          // Look for <Button ...>Text</Button> on single line
          const match = /<Button\b[^>]*>([^<{]+)<\/Button>/i.exec(line);
          if (match && match[1]) {
            const v = lintButtonLabel(match[1]);
            for (const item of v) {
              violations.push({ file: full, line: idx + 1, violation: item });
            }
          }
        });
      }
    }
  }

  scan(srcDir);
  return { passed: violations.length === 0, violations };
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { passed, violations } = runLabelLint();
  if (!passed) {
    console.error(`❌ Found ${violations.length} button label violations:`);
    for (const v of violations) {
      console.error(`  ${path.basename(v.file)}:${v.line} - ${v.violation.message} ("${v.violation.label}")`);
    }
    process.exit(1);
  } else {
    console.log('✓ Button label lint passed: All button labels follow sentence-case content rules.');
  }
}

