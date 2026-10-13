---
title: "ADR-0006: Build & Packaging"
description: "ADR-0006: Build & Packaging documentation."
area: "design"
status: "available"
order: 6
---

<!-- @generated from docs/adr/0006-build-and-packaging.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0006</span>
      <div class="rx-adr-title">ADR-0006: Build & Packaging</div>
    </div>
    <span class="rx-adr-status rx-adr-accepted">
      <span class="rx-status-dot"></span>
      Accepted
    </span>
  </div>
  <div class="rx-adr-meta-grid">
    <div class="rx-meta-item">
      <span class="rx-meta-label">Status</span>
      <span class="rx-meta-value">Accepted</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Decision Date</span>
      <span class="rx-meta-value">2026-10</span>
    </div>
    <div class="rx-meta-item">
      <span class="rx-meta-label">Deciders</span>
      <span class="rx-meta-value">REQNX Architecture Team</span>
    </div>
  </div>
</div>

## Context

Packages must work in both ESM and CJS environments, produce correct `.d.ts` declarations, and pass `publint` + `@arethetypeswrong/cli` checks.

## Decision

### Bundler: tsdown

- **tsdown** (Rolldown-based, Rust-powered)  -  stable as of 2026, ~10x faster than tsup.
- Produces dual ESM (`.js`) + CJS (`.cjs`) + declarations (`.d.ts`).
- Falls back to **tsup** only if a blocking bug is encountered.

### Package `"exports"` map

Every package uses the three-condition exports pattern:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

`"types"` condition is listed first per TypeScript recommendations.

### TypeScript configuration

Shared `tsconfig.base.json` with strict mode plus:

- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `verbatimModuleSyntax`
- `isolatedModules`

Per-package `tsconfig.json` extends the base with local `rootDir`/`outDir`.

### Verification in CI

After every build, CI runs:

1. `publint`  -  validates package.json exports, files, and conventions
2. `@arethetypeswrong/cli`  -  validates type resolution across all conditions

### `"type": "module"` everywhere

All packages use `"type": "module"` in package.json. Internal imports use `.js` extensions (verbatimModuleSyntax).

## Consequences

- Fast builds (~100ms per package)
- Correct ESM + CJS + types in every published package
- CI catches packaging regressions automatically
- `.js` extension imports may surprise contributors used to extensionless imports

## Alternatives Considered

- **tsup**: Works but slower. tsdown is the maintained successor.
- **tsc-only (no bundler)**: Doesn't produce CJS from ESM source; would need two tsconfigs per package.
- **Rollup + plugins**: More configuration, more plugins to maintain. tsdown handles it all.
- **esbuild**: Fast but poor `.d.ts` support without additional tools.
