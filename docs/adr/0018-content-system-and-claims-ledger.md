# ADR 0018: Content System & Claims Ledger

## Status
Accepted

## Context
Developer tooling documentation and landing pages frequently suffer from unsubstantiated marketing hype ("blazing fast", "revolutionary", "zero-overhead", "best-in-class"). Infrastructure and backend engineers evaluating rate limiters require verifiable facts: atomic guarantees, state transition mechanics, memory footprint, test coverage, and clear explanations of trade-offs and edge cases.

To establish deep developer trust, Reqnx must enforce a disciplined content system where every technical claim is verifiable, unreleased features are plainly disclosed, and marketing superlatives are strictly barred.

## Decision
1. **The Claims Ledger (`docs/site/claims.md`)**:
   - Every factual claim published on the landing page (throughput numbers, memory footprint, test counts, package counts, zero-dependency assertions) must be logged in `docs/site/claims.md` with an explicit verification command or source file path.
   - Any claim that cannot be verified by running a command in the repository is prohibited.

2. **Strict Anti-Hype Policy**:
   - The following buzzwords and subjective superlatives are prohibited across all site copy:
     - "blazing fast", "lightning quick", "ultra-fast"
     - "revolutionary", "game-changing", "next-generation"
     - "zero overhead", "unrivaled", "best-in-class"
     - Exclamation marks in product descriptions and value propositions.
   - Tone is modeled on standard infrastructure documentation (Redis, Cloudflare, Envoy): technical, descriptive, calm, and precise.

3. **Feature Availability Gating (`apps/site/src/features.ts`)**:
   - The site uses `apps/site/src/features.ts` as the single source of truth for all feature status indicators.
   - Features marked `available` must point to an active, passing `evidencePath` in the monorepo (e.g., `packages/core/src/algorithms/fixed-window.ts`).
   - Features in development (e.g., RedisStore Lua scripts, Sliding Window) are explicitly labeled as "In Progress" or "Planned" with their roadmap target day.

4. **Honest Boundary & Trade-Off Disclosure**:
   - The landing page prominently includes:
     - The **Window Boundary Burst** demonstration, visually proving the $2\times$ boundary anomaly inherent to Fixed Window counters.
     - A dedicated **"When NOT to use Reqnx"** section advising engineers when Envoy, Nginx, or single-process counters are more appropriate.

5. **Live In-Browser Verification**:
   - Rather than mocking UI interactions, the hero instrument runs the actual `@reqnx/core` library directly in the client browser, demonstrating atomic decisions in real time.

## Consequences
- High credibility with systems and backend engineers who review the source code.
- Continuous synchronization between codebase maturity and documentation claims.
- Copy reviews (`docs/site/copy-review.md`) enforce adherence prior to each release.
