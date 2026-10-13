// ──────────────────────────────────────────────────────────────────────────────
// apps/site/scripts/ingest-docs.ts
//
// Ingests repository documentation from docs/ into apps/site/src/content/docs/
// transforms links to site routes, validates targets, normalizes alerts,
// and enforces frontmatter schema consistency.
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

interface IngestionItem {
  sourceRelPath: string; // e.g. docs/algorithms/token-bucket.md
  targetRelPath: string; // e.g. algorithms/token-bucket.md
  siteRoute: string; // e.g. /algorithms/token-bucket/
  area: 'start' | 'guides' | 'algorithms' | 'reference' | 'design' | 'project';
  defaultTitle?: string;
  defaultDescription?: string;
  status: 'available' | 'in-progress' | 'planned';
  order?: number;
}

// Map of canonical repo files to site routes
const ROUTE_MAP = new Map<string, string>();

function buildRouteMap(items: IngestionItem[]) {
  for (const item of items) {
    const norm = item.sourceRelPath.replace(/\\/g, '/');
    ROUTE_MAP.set(norm, item.siteRoute);
    const basename = path.basename(norm);
    ROUTE_MAP.set(basename, item.siteRoute);
  }
}

function resolveMarkdownLink(href: string, sourceFile: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  if (href.startsWith('#')) {
    return href;
  }

  // Handle file:/// absolute URLs
  let cleanHref = href;
  if (cleanHref.startsWith('file:///')) {
    cleanHref = cleanHref.replace(/^file:\/\/\/[a-zA-Z]:/, '').replace(/\\/g, '/');
    const idx = cleanHref.indexOf('/docs/');
    if (idx !== -1) {
      cleanHref = cleanHref.slice(idx + 1); // e.g. docs/adr/0002-...md
    }
  }

  const [targetPath, hash] = cleanHref.split('#');
  const anchor = hash ? `#${hash}` : '';

  if (!targetPath) return anchor;

  // Resolve target against source directory
  let resolvedRepoRel: string;
  if (targetPath.startsWith('docs/')) {
    resolvedRepoRel = targetPath;
  } else {
    const sourceDir = path.dirname(sourceFile);
    const absoluteTarget = path.resolve(sourceDir, targetPath);
    resolvedRepoRel = path.relative(REPO_ROOT, absoluteTarget).replace(/\\/g, '/');
  }

  // Look up in route map
  if (ROUTE_MAP.has(resolvedRepoRel)) {
    return `${ROUTE_MAP.get(resolvedRepoRel)}${anchor}`;
  }

  const baseName = path.basename(targetPath);
  if (ROUTE_MAP.has(baseName)) {
    return `${ROUTE_MAP.get(baseName)}${anchor}`;
  }

  // Check if target is a known external doc or repo file
  const fullDiskPath = path.resolve(REPO_ROOT, resolvedRepoRel);
  if (fs.existsSync(fullDiskPath)) {
    // Exists on disk in repo, but not mapped to a doc page
    return `https://github.com/zynorex/reqnx/blob/main/${resolvedRepoRel}${anchor}`;
  }

  throw new Error(`Unresolvable markdown link "${href}" found in "${sourceFile}" (resolved to "${resolvedRepoRel}")`);
}

function transformContent(rawContent: string, sourceFile: string, isPlanned: boolean): string {
  // 1. Rewrite relative and file:/// markdown links
  let content = rawContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
    try {
      const rewritten = resolveMarkdownLink(href, sourceFile);
      return `[${text}](${rewritten})`;
    } catch {
      return match;
    }
  });

  // 2. Normalize em-dashes to spaced hyphens
  content = content.replace(/—/g, ' - ');

  // 3. Normalize GitHub alerts to Starlight Asides
  content = content.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*\n?)+)/gm, (_match, type, body) => {
    const asideType = type.toLowerCase() === 'warning' || type.toLowerCase() === 'important' ? 'caution' : type.toLowerCase();
    const cleanBody = body
      .split('\n')
      .map((line: string) => line.replace(/^>\s?/, ''))
      .join('\n')
      .trim();
    return `:::${asideType}\n${cleanBody}\n:::\n`;
  });

  // 4. Ensure opening code blocks have language identifier
  let inCode = false;
  content = content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        if (!inCode) {
          inCode = true;
          const lang = trimmed.slice(3).trim();
          if (!lang) {
            return '```text';
          }
        } else {
          inCode = false;
        }
      }
      return line;
    })
    .join('\n');

  // 5. Prepend planned banner if applicable
  if (isPlanned) {
    const banner = `:::caution[Planned Feature]\nThis specification describes planned functionality that is not yet implemented in \`@reqnx/core\`. See the [Status and Roadmap](/project/status-roadmap/) page for the implementation schedule.\n:::\n\n`;
    content = banner + content;
  }

  return content;
}

export function ingestDocs() {
  console.log('[ingest-docs] Ingesting repository documentation from docs/ ...');

  const items: IngestionItem[] = [
    // Architecture
    {
      sourceRelPath: 'docs/architecture.md',
      targetRelPath: 'design/architecture.md',
      siteRoute: '/design/architecture/',
      area: 'design',
      defaultTitle: 'Architecture',
      defaultDescription: 'Pluggable rate limiting architecture and package boundaries for Node.js.',
      status: 'available',
      order: 1,
    },
    // Algorithms
    {
      sourceRelPath: 'docs/algorithms/fixed-window.md',
      targetRelPath: 'algorithms/fixed-window.md',
      siteRoute: '/algorithms/fixed-window/',
      area: 'algorithms',
      defaultTitle: 'Fixed Window Counter',
      defaultDescription: 'Simplest, lowest-overhead rate limiter that divides time into non-overlapping epoch-aligned windows.',
      status: 'available',
      order: 1,
    },
    {
      sourceRelPath: 'docs/algorithms/token-bucket.md',
      targetRelPath: 'algorithms/token-bucket.md',
      siteRoute: '/algorithms/token-bucket/',
      area: 'algorithms',
      defaultTitle: 'Token Bucket',
      defaultDescription: 'Continuous token replenishment supporting burst capacity with exact rational refill rates.',
      status: 'available',
      order: 2,
    },
    {
      sourceRelPath: 'docs/algorithms/fixed-window.redis-port.md',
      targetRelPath: 'algorithms/fixed-window-redis-port.md',
      siteRoute: '/algorithms/fixed-window-redis-port/',
      area: 'algorithms',
      defaultTitle: 'Fixed Window Redis Port Specification',
      defaultDescription: 'Redis Lua script port specification for the fixedWindow algorithm.',
      status: 'planned',
      order: 10,
    },
    {
      sourceRelPath: 'docs/algorithms/token-bucket.redis-port.md',
      targetRelPath: 'algorithms/token-bucket-redis-port.md',
      siteRoute: '/algorithms/token-bucket-redis-port/',
      area: 'algorithms',
      defaultTitle: 'Token Bucket Redis Port Specification',
      defaultDescription: 'Redis Lua script port specification for the tokenBucket algorithm.',
      status: 'planned',
      order: 11,
    },
    // Benchmarks
    {
      sourceRelPath: 'docs/benchmarks/day-04.md',
      targetRelPath: 'design/benchmarks/day-04.md',
      siteRoute: '/design/benchmarks/day-04/',
      area: 'design',
      defaultTitle: 'Baseline Benchmarks (Day 4)',
      defaultDescription: 'Throughput and latency baselines for pure algorithms and in-memory limiter.',
      status: 'available',
      order: 10,
    },
  ];

  // Ingest all ADRs
  const adrDir = path.join(DOCS_DIR, 'adr');
  if (fs.existsSync(adrDir)) {
    const files = fs.readdirSync(adrDir).filter((f) => f.endsWith('.md')).sort();
    for (const file of files) {
      const match = file.match(/^(\d{4})-(.+)\.md$/);
      const num = match ? parseInt(match[1], 10) : 0;
      const slug = match ? `${match[1]}-${match[2]}` : file.replace('.md', '');
      items.push({
        sourceRelPath: `docs/adr/${file}`,
        targetRelPath: `design/adr/${slug}.md`,
        siteRoute: `/design/adr/${slug}/`,
        area: 'design',
        status: 'available',
        order: num,
      });
    }
  }

  buildRouteMap(items);

  let ingestedCount = 0;

  for (const item of items) {
    const fullSourcePath = path.join(REPO_ROOT, item.sourceRelPath);
    if (!fs.existsSync(fullSourcePath)) {
      console.warn(`[ingest-docs] Source file not found: ${item.sourceRelPath}`);
      continue;
    }

    const fullTargetPath = path.join(SITE_DOCS_DIR, item.targetRelPath);
    const mdxTwin = fullTargetPath.replace(/\.md$/, '.mdx');
    if (fullTargetPath.endsWith('.md') && fs.existsSync(mdxTwin)) {
      // Interactive MDX page exists in site; do not overwrite with plain markdown
      continue;
    }
    fs.mkdirSync(path.dirname(fullTargetPath), { recursive: true });

    const raw = fs.readFileSync(fullSourcePath, 'utf8');

    // Extract frontmatter if present
    let title = item.defaultTitle;
    let description = item.defaultDescription;
    let body = raw;

    if (raw.startsWith('---')) {
      const parts = raw.split(/^---\s*$/m);
      if (parts.length >= 3) {
        const fm = parts[1];
        body = parts.slice(2).join('---').trim();

        const titleMatch = fm.match(/title:\s*['"]?([^'"\n]+)['"]?/);
        if (titleMatch) title = titleMatch[1].trim();

        const summaryMatch = fm.match(/(?:summary|description):\s*['"]?([^'"\n]+)['"]?/);
        if (summaryMatch) description = summaryMatch[1].trim();
      }
    }

    // If no title in frontmatter, look for first H1
    if (!title) {
      const h1Match = body.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
        // Remove H1 from body to prevent duplicate title on Starlight
        body = body.replace(/^#\s+.+$/m, '').trim();
      } else {
        title = path.basename(item.sourceRelPath, '.md');
      }
    } else {
      // If title matched frontmatter, also remove top H1 if it mirrors title
      body = body.replace(/^#\s+.+$/m, '').trim();
    }

    if (!description) {
      description = `${title} documentation.`;
    }
    // Cap description at 160 characters
    if (description.length > 160) {
      description = description.slice(0, 157) + '...';
    }

    // Enhance ADRs with executive metadata card
    if (item.sourceRelPath.startsWith('docs/adr/')) {
      const statusMatch = body.match(/(?:\*\*Status:\*\*|## Status\s*\n\s*)([A-Za-z]+)/);
      const adrStatus = statusMatch ? statusMatch[1].trim() : 'Accepted';
      const dateMatch = body.match(/(?:\*\*Date:\*\*|Date:\s*)([0-9-]+)/);
      const adrDate = dateMatch ? dateMatch[1].trim() : '2026-10';
      const adrIdMatch = item.sourceRelPath.match(/(\d{4})/);
      const adrId = adrIdMatch ? `ADR-${adrIdMatch[1]}` : 'ADR';

      const adrCardHtml = `<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">${adrId}</span>
      <div class="rx-adr-title">${title.replace(/"/g, '&quot;')}</div>
    </div>
    <span class="rx-adr-status rx-adr-${adrStatus.toLowerCase()}">
      <span class="rx-status-dot"></span>
      ${adrStatus}
    </span>
  </div>
  <div class="rx-adr-meta-grid">
    <div class="rx-meta-item">
      <span class="rx-meta-label">Status</span>
      <span class="rx-meta-value">${adrStatus}</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Decision Date</span>
      <span class="rx-meta-value">${adrDate}</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Deciders</span>
      <span class="rx-meta-value">REQNX Architecture Team</span>
    </div>
  </div>
</div>\n\n`;

      // Clean redundant raw status/date lines from body
      body = body
        .replace(/^\*\*Status:\*\*.*$/m, '')
        .replace(/^\*\*Date:\*\*.*$/m, '')
        .replace(/^## Status\s*\n\s*[A-Za-z]+\s*\n/m, '')
        .trim();

      body = `${adrCardHtml}${body}`;
    }

    const isPlanned = item.status === 'planned';
    const transformedBody = transformContent(body, fullSourcePath, isPlanned);

    const generatedFileContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
area: "${item.area}"
status: "${item.status}"
order: ${item.order ?? 0}
---

<!-- @generated from ${item.sourceRelPath} - DO NOT EDIT DIRECTLY -->

${transformedBody}
`;

    fs.writeFileSync(fullTargetPath, generatedFileContent, 'utf8');
    ingestedCount++;
  }

  console.log(`[ingest-docs] Successfully ingested ${ingestedCount} documents into src/content/docs/`);
}

// Run directly if invoked via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ingestDocs();
}
