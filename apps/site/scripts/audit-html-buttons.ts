// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/audit-html-buttons.ts
//
// HTML conformance auditor for built pages in dist/**/*.html.
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

export interface HtmlAuditViolation {
  file: string;
  tag: string;
  message: string;
}

export function auditHtmlContent(file: string, html: string): HtmlAuditViolation[] {
  const violations: HtmlAuditViolation[] = [];

  // Check 1: <a> without href
  const anchorNoHrefRegex = /<a\b(?![^>]*\bhref=)[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorNoHrefRegex.exec(html)) !== null) {
    violations.push({
      file,
      tag: match[0],
      message: 'Found <a> tag without href attribute.',
    });
  }

  // Check 2: <button> with href
  const buttonWithHrefRegex = /<button\b[^>]*\bhref=[^>]*>/gi;
  while ((match = buttonWithHrefRegex.exec(html)) !== null) {
    violations.push({
      file,
      tag: match[0],
      message: 'Found <button> tag with invalid href attribute.',
    });
  }

  // Check 3: href="#"
  const hrefHashRegex = /<a\b[^>]*\bhref=['"]#['"][^>]*>/gi;
  while ((match = hrefHashRegex.exec(html)) !== null) {
    // skip in-page hash links like href="#status" or href="#main-content"
    violations.push({
      file,
      tag: match[0],
      message: 'Found fake <a> with href="#".',
    });
  }

  // Check 4: role="button" on anchors
  const roleButtonOnAnchor = /<a\b[^>]*\brole=['"]button['"][^>]*>/gi;
  while ((match = roleButtonOnAnchor.exec(html)) !== null) {
    violations.push({
      file,
      tag: match[0],
      message: 'Found role="button" on <a> tag.',
    });
  }

  // Check 5: Icon-only buttons without accessible name
  const iconOnlyRegex = /<button\b[^>]*data-icon-only=['"]true['"][^>]*>/gi;
  while ((match = iconOnlyRegex.exec(html)) !== null) {
    const tag = match[0];
    const hasAriaLabel = /aria-label=['"][^'"]+['"]/i.test(tag);
    if (!hasAriaLabel) {
      violations.push({
        file,
        tag,
        message: 'Icon-only button missing aria-label attribute.',
      });
    }
  }

  return violations;
}

function scanHtmlFiles(dir: string, violations: HtmlAuditViolation[]) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanHtmlFiles(fullPath, violations);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = fs.readFileSync(fullPath, 'utf-8');
      violations.push(...auditHtmlContent(fullPath, html));
    }
  }
}

export function runHtmlAudit(): { passed: boolean; violations: HtmlAuditViolation[] } {
  const violations: HtmlAuditViolation[] = [];
  scanHtmlFiles(DIST_DIR, violations);
  return {
    passed: violations.length === 0,
    violations,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { passed, violations } = runHtmlAudit();
  if (!passed) {
    console.error(`❌ Found ${violations.length} HTML button audit violations:`);
    for (const v of violations) {
      console.error(`  ${path.relative(DIST_DIR, v.file)}: ${v.message}\n    ${v.tag}`);
    }
    process.exit(1);
  } else {
    console.log('✓ HTML button audit passed: All buttons and anchors meet semantic contracts.');
  }
}
