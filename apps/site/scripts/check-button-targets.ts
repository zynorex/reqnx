// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/check-button-targets.ts
//
// Validates that all button sizes and pointer variants meet WCAG 2.5.8 / 2.5.5
// target size requirements (>= 44x44px for coarse pointers, >= 32px for desktop).
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUTTONS_CSS = path.resolve(__dirname, '../src/styles/buttons.css');

export interface TargetSizeCheckResult {
  passed: boolean;
  checks: {
    name: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
}

export function checkButtonTargets(): TargetSizeCheckResult {
  const content = fs.readFileSync(BUTTONS_CSS, 'utf-8');

  const checks = [
    {
      name: 'Size sm minimum height (>= 32px)',
      expected: '>= 32px',
      actual: '',
      passed: false,
    },
    {
      name: 'Size md minimum height (>= 40px)',
      expected: '>= 40px',
      actual: '',
      passed: false,
    },
    {
      name: 'Size lg minimum height (>= 48px)',
      expected: '>= 48px',
      actual: '',
      passed: false,
    },
    {
      name: 'Touch target expansion for coarse pointers (>= 44x44px)',
      expected: 'min-width: 44px, min-height: 44px',
      actual: '',
      passed: false,
    },
    {
      name: 'Icon-only sm button width (>= 32px)',
      expected: '>= 32px',
      actual: '',
      passed: false,
    },
  ];

  // Check 1: sm height
  const smMatch = content.match(/--rx-btn-h-sm,\s*(\d+)px\)/);
  if (smMatch && smMatch[1]) {
    const val = parseInt(smMatch[1], 10);
    checks[0]!.actual = `${val}px`;
    checks[0]!.passed = val >= 32;
  }

  // Check 2: md height
  const mdMatch = content.match(/--rx-btn-h-md,\s*(\d+)px\)/);
  if (mdMatch && mdMatch[1]) {
    const val = parseInt(mdMatch[1], 10);
    checks[1]!.actual = `${val}px`;
    checks[1]!.passed = val >= 40;
  }

  // Check 3: lg height
  const lgMatch = content.match(/--rx-btn-h-lg,\s*(\d+)px\)/);
  if (lgMatch && lgMatch[1]) {
    const val = parseInt(lgMatch[1], 10);
    checks[2]!.actual = `${val}px`;
    checks[2]!.passed = val >= 48;
  }

  // Check 4: coarse pointer ::after
  const hasCoarseMedia = content.includes('@media (pointer: coarse)');
  const hasMin44w = /min-width:\s*44px/.test(content);
  const hasMin44h = /min-height:\s*44px/.test(content);
  if (hasCoarseMedia && hasMin44w && hasMin44h) {
    checks[3]!.actual = 'min-width: 44px, min-height: 44px';
    checks[3]!.passed = true;
  } else {
    checks[3]!.actual = `coarse=${hasCoarseMedia}, w44=${hasMin44w}, h44=${hasMin44h}`;
    checks[3]!.passed = false;
  }

  // Check 5: Icon-only sm button width
  const hasIconSmWidth = content.includes("width: var(--rx-btn-h-sm, 32px);");
  if (hasIconSmWidth) {
    checks[4]!.actual = '32px';
    checks[4]!.passed = true;
  } else {
    checks[4]!.actual = 'not found';
    checks[4]!.passed = false;
  }

  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkButtonTargets();
  console.log('Button Target Size Verification:');
  for (const c of result.checks) {
    const icon = c.passed ? '✓' : '❌';
    console.log(`  ${icon} ${c.name}: ${c.actual} (expected: ${c.expected})`);
  }
  if (!result.passed) {
    process.exit(1);
  } else {
    console.log('\nAll button target size requirements satisfied.');
  }
}
