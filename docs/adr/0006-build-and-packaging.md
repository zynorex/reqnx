# ADR-0006: Build & Packaging

**Status:** Accepted  
**Date:** 2026-10-01

## Context

Packages must work in both ESM and CJS environments, produce correct `.d.ts` declarations, and pass `publint` + `@arethetypeswrong/cli` checks.

## Decision

### Bundler: tsdown

- **tsdown** (Rolldown-based, Rust-powered) — stable as of 2026, ~10x faster than tsup.
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

1. `publint` — validates package.json exports, files, and conventions
2. `@arethetypeswrong/cli` — validates type resolution across all conditions

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
