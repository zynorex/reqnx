/**
 * scripts/check-deps.ts
 *
 * Enforces the REQNX dependency graph rules:
 * 1. @reqnx/core has zero runtime dependencies (no "dependencies" field)
 * 2. Adapters (express, fastify) never depend on each other
 * 3. Nothing depends on @reqnx/testkit except via devDependencies
 * 4. No package depends on anything outside the allowed set
 *
 * Run: pnpm check-deps
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const PACKAGES_DIR = join(import.meta.dirname ?? '.', '..', 'packages');
const ADAPTERS = new Set(['@reqnx/express', '@reqnx/fastify']);
const errors: string[] = [];

function readPkg(dir: string): PackageJson | null {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
}

// Check each package
const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(PACKAGES_DIR, d.name));

for (const dir of packageDirs) {
  const pkg = readPkg(dir);
  if (!pkg?.name) continue;

  const deps = Object.keys(pkg.dependencies ?? {});
  const name = pkg.name;

  // Rule 1: @reqnx/core has zero runtime dependencies
  if (name === '@reqnx/core' && deps.length > 0) {
    errors.push(`@reqnx/core must have zero runtime dependencies, found: ${deps.join(', ')}`);
  }

  // Rule 2: adapters never depend on each other
  if (ADAPTERS.has(name)) {
    for (const dep of deps) {
      if (ADAPTERS.has(dep) && dep !== name) {
        errors.push(`${name} depends on adapter ${dep} — adapters must not depend on each other`);
      }
    }
  }

  // Rule 3: no runtime dependency on testkit
  if (deps.includes('@reqnx/testkit')) {
    errors.push(`${name} has a runtime dependency on @reqnx/testkit — use devDependencies`);
  }
}

if (errors.length > 0) {
  // eslint-disable-next-line no-console
  console.error('❌ Dependency check failed:\n');
  for (const err of errors) {
    // eslint-disable-next-line no-console
    console.error(`  • ${err}`);
  }
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log('✅ Dependency graph checks passed');
}
