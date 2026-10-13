// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/lint-docs.ts
//
// Style and quality linter for documentation pages (both docs/ and site content).
// Enforces writing standards defined in docs/STYLE.md.
// ──────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRepoRoot(startDir: string): string {
  let curr = startDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(curr, 'packages', 'core', 'package.json'))) {
      return curr;
    }
    curr = path.resolve(curr, '..');
  }
  return path.resolve(startDir, '../..');
}

const REPO_ROOT = findRepoRoot(__dirname);
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const SITE_DOCS_DIR = path.join(REPO_ROOT, 'apps', 'site', 'src', 'content', 'docs');

const BANNED_MINIMISING_WORDS = [
  'simply',
  'just',
  'easy',
  'easily',
  'obviously',
  'of course',
  'trivial',
];

const BANNED_HYPE_WORDS = [
  'blazing',
  'seamless',
  'powerful',
  'effortless',
  'robust',
  'revolutionary',
  'next-generation',
  'supercharge',
  'unlock',
  'leverage',
  'world-class',
  'production-ready',
  'battle-tested',
  'enterprise-grade',
];

const BANNED_LINK_TEXTS = [
  'here',
  'click here',
  'link',
  'this link',
  'read more',
];

export interface LintError {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

function getAllDocFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getAllDocFiles(full, baseDir));
    } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
      results.push(full);
    }
  }
  return results;
}

export function lintFile(filePath: string): LintError[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const errors: LintError[] = [];

  // Exclude STYLE.md itself from word bans (since it explicitly lists them)
  const isStyleGuide = relPath.endsWith('STYLE.md') || relPath.endsWith('docs-plan.md');

  let inCodeBlock = false;
  let inFrontmatter = false;
  const frontmatterLines: string[] = [];
  let descriptionFound = false;
  let descriptionLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Frontmatter toggle
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      frontmatterLines.push(line);
      const descMatch = line.match(/(?:description|summary):\s*['"]?([^'"\n]+)['"]?/);
      if (descMatch) {
        descriptionFound = true;
        descriptionLength = descMatch[1].trim().length;
      }
      continue;
    }

    // Code block toggle
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const lang = trimmed.slice(3).trim().split(/\s+/)[0];
        if (!lang) {
          errors.push({
            file: relPath,
            line: lineNum,
            rule: 'code-fence-lang',
            message: 'Code block fence must specify a language identifier.',
            severity: 'error',
          });
        }
      } else {
        inCodeBlock = false;
      }
      continue;
    }

    // Skip linting inside code blocks
    if (inCodeBlock) continue;

    if (!isStyleGuide) {
      // 1. Minimising words
      const lower = line.toLowerCase();
      for (const word of BANNED_MINIMISING_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(line)) {
          errors.push({
            file: relPath,
            line: lineNum,
            rule: 'no-minimising-words',
            message: `Banned minimising word found: "${word}". State what to do factually without minimizing effort.`,
            severity: 'error',
          });
        }
      }

      // 2. Hype words (exempt ADRs documenting banned word lists)
      if (!relPath.includes('/adr/')) {
        for (const word of BANNED_HYPE_WORDS) {
          const regex = new RegExp(`\\b${word}\\b`, 'i');
          if (regex.test(line)) {
            errors.push({
              file: relPath,
              line: lineNum,
              rule: 'no-hype-words',
              message: `Banned marketing hype word found: "${word}". Use factual, engineering descriptions.`,
              severity: 'error',
            });
          }
        }
      }

      // 3. Em dashes
      if (line.includes('—')) {
        errors.push({
          file: relPath,
          line: lineNum,
          rule: 'no-em-dash',
          message: 'Em dash (—) is banned in docs. Use hyphens with spaces, commas, or parentheses.',
          severity: 'error',
        });
      }

      // 4. Exclamation marks in prose (excluding math / code delimiters)
      if (line.includes('!') && !line.includes('![') && !line.includes('!=') && !line.includes('!(') && !line.includes('<!--')) {
        // Check if ! is at the end of a sentence or word
        if (/[a-zA-Z0-9]\s*!/.test(line)) {
          errors.push({
            file: relPath,
            line: lineNum,
            rule: 'no-exclamation-mark',
            message: 'Exclamation marks are banned in documentation. State facts plainly.',
            severity: 'error',
          });
        }
      }

      // 5. Uninformative link text
      const linkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const m of linkMatches) {
        const linkText = m[1].toLowerCase().trim();
        if (BANNED_LINK_TEXTS.includes(linkText)) {
          errors.push({
            file: relPath,
            line: lineNum,
            rule: 'meaningful-links',
            message: `Uninformative link text found: "${m[1]}". Name the destination document or symbol.`,
            severity: 'error',
          });
        }
      }
    }

    // 6. Heading rules
    if (trimmed.startsWith('#')) {
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();

        if (level > 4) {
          errors.push({
            file: relPath,
            line: lineNum,
            rule: 'heading-depth',
            message: `Heading depth h${level} exceeds maximum depth of h4.`,
            severity: 'error',
          });
        }

        // Check sentence case for h2+ (ignore markdown links, symbols, codes, acronyms)
        if (level >= 2 && !isStyleGuide) {
          const cleanText = text.replace(/`[^`]+`/g, '').replace(/\[[^\]]+\]/g, '');
          const words = cleanText.split(/\s+/).filter(Boolean);
          if (words.length > 2) {
            // Count capitalized words (excluding first word and common acronyms)
            let midCaps = 0;
            for (let w = 1; w < words.length; w++) {
              const word = words[w];
              if (
                /^[A-Z][a-z]+/.test(word) &&
                !['REQNX', 'Node.js', 'Redis', 'ADR', 'Lua', 'TypeScript', 'API', 'CPU', 'RAM', 'CI', 'NTP', 'GCD', 'TTL', 'IETF', 'LRU'].includes(word)
              ) {
                midCaps++;
              }
            }
            if (midCaps >= 2) {
              errors.push({
                file: relPath,
                line: lineNum,
                rule: 'sentence-case-headings',
                message: `Heading appears to be Title Case instead of sentence case: "${text}".`,
                severity: 'warning',
              });
            }
          }
        }
      }
    }

    // 7. Image alt text check
    const imgMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
    for (const m of imgMatches) {
      if (!m[1] || m[1].trim().length === 0) {
        errors.push({
          file: relPath,
          line: lineNum,
          rule: 'image-alt-text',
          message: 'Image must include descriptive alt text.',
          severity: 'error',
        });
      }
    }

    // 8. Absolute claims warning without links
    if (/\b(always|never|guaranteed)\b/i.test(line) && !line.includes('http') && !line.includes('ADR-') && !line.includes('claim-')) {
      errors.push({
        file: relPath,
        line: lineNum,
        rule: 'evidence-backed-claims',
        message: `Absolute claim keyword found without an evidence link: "${line.trim()}".`,
        severity: 'warning',
      });
    }
  }

  // Check description length
  if (descriptionFound && descriptionLength > 160) {
    errors.push({
      file: relPath,
      line: 1,
      rule: 'description-length',
      message: `Frontmatter description (${descriptionLength} chars) exceeds 160 characters.`,
      severity: 'error',
    });
  }

  return errors;
}

export function lintDocs(): boolean {
  console.log('[lint-docs] Checking documentation writing standards against docs/STYLE.md ...');

  const files = [
    ...getAllDocFiles(DOCS_DIR),
    ...getAllDocFiles(SITE_DOCS_DIR),
  ];

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const errs = lintFile(file);
    for (const err of errs) {
      if (err.severity === 'error') {
        totalErrors++;
        console.error(`  ERROR   ${err.file}:${err.line} [${err.rule}] ${err.message}`);
      } else {
        totalWarnings++;
        console.warn(`  WARN    ${err.file}:${err.line} [${err.rule}] ${err.message}`);
      }
    }
  }

  console.log(`\n[lint-docs] Finished audit: ${totalErrors} error(s), ${totalWarnings} warning(s) across ${files.length} doc files.`);

  return totalErrors === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const success = lintDocs();
  if (!success) {
    process.exit(1);
  }
}
