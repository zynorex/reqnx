# Contributing to REQNX

Thank you for your interest in contributing to REQNX! This guide will be expanded as the project matures.

## Development Setup

```bash
# Prerequisites: Node.js ≥ 22, pnpm
corepack enable
pnpm install

# Run the full verification suite
pnpm verify

# Or run individual checks
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## For Redis integration tests

```bash
docker compose up -d
pnpm test
docker compose down
```

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — tooling, CI, deps
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests

## Definition of Done (New Algorithm)

1. Pure TS `step()` + `peek()` + `parseConfig()` + `stateTtlMs()`
2. Lua port in `@reqnx/redis`
3. Conformance suite cases in `@reqnx/testkit`
4. Property-based tests (fast-check)
5. Unit tests for edge cases
6. TSDoc documentation
7. Benchmark entry

## Adding Dependencies

**Ask before adding any dependency** that isn't already in the project. `@reqnx/core` must have zero runtime dependencies.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
