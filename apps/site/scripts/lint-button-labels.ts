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
