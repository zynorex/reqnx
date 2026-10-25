# Documentation Experience Plan & Specification (Starlight)

This specification defines the UX-first transformation of the REQNX documentation site (`/docs`).
Approved at Gate 1 on branch `docs-experience`.

---

## 1. Baseline Metrics (Stage 0 Baseline)

- **Total Built Pages**: 6 pages (`/`, `/404`, `/getting-started/`, `/algorithms/`, `/algorithms/fixed-window/`, `/playground/`).
- **Initial Docs Pages**: 4 pages.
- **Search Engine**: Pagefind v1.5.2 (4 pages indexed, 649 words).
- **Page Performance Baseline**:
  - `/getting-started/`: HTML 8.59 KB gz, JS 4.27 KB gz (8.70 KB raw), CSS 21.44 KB gz (110.87 KB raw).
  - `/algorithms/`: HTML 7.76 KB gz, JS 3.14 KB gz (6.23 KB raw), CSS 17.57 KB gz (93.08 KB raw).
  - `/algorithms/fixed-window/`: HTML 13.13 KB gz, JS 7.84 KB gz (18.51 KB raw), CSS 21.44 KB gz (110.87 KB raw).
  - `/playground/`: HTML 9.58 KB gz, JS 6.70 KB gz (16.05 KB raw), CSS 17.57 KB gz (93.08 KB raw).
- **Preconditions**: Verified all components, claims, brand assets, base-path helpers, scenario engine, button system, and green monorepo pipeline (`pnpm verify`).

---

## 2. Reference Study of 8 Documentation Sites

| Site | Outstanding Patterns | Adopt for REQNX | Avoid for REQNX |
| :--- | :--- | :--- | :--- |
| **Stripe** | Unified schema breakdowns, side-by-side parameter & response inspector, subtle copy buttons. | Tabular breakdown of config/parameters with types, constraints, and defaults; polite copy toast. | Fixed 2-column scroll desync; heavy client-side layout scripts. |
| **Vercel** | Instant Cmd+K search modal with category badges; persistent package manager tabs. | Fast modal search with category groupings; `syncKey` tab state stored in `localStorage` with try/catch. | Marketing promos within technical guides; hidden sidebar scroll overflow. |
| **Tailwind CSS** | Immediate "At a glance" property matrix at the top of pages; rapid scannability; zero prose fluff. | `AtAGlance` summary panel on algorithm pages; quick reference tables for Decision fields. | Pure syntax dump without rationale or production operational guidance. |
| **Cloudflare** | Explicit product boundaries; honest capability badges ("Beta", "GA"); clear prerequisites. | `StatusChip` reflecting `features.ts`; explicit "Prerequisites" and "Next steps" on every guide. | Deep navigation nesting (>3 levels); heavy first-load bundle. |
| **Redis** | Algorithmic time/space complexity badges ($O(1)$); `@since` release tags; strict argument syntax. | Complexity readouts on all algorithm pages; `@since` tags; strict error code taxonomy. | Monolithic text walls; dated terminal chrome without contrast tuning. |
| **Supabase** | Synced multi-language code snippets; clean issue report link with prepopulated metadata. | Repo-linked issue reporter prefilling page URL and active heading anchor; synced package managers. | Floating AI assistant covering reading flow; client-side telemetry. |
| **Astro / Starlight** | Zero-JS readable HTML core; Expressive Code frame integration; accessible sidebar disclosures. | Wrap native Starlight primitives; Expressive Code file/terminal frames; Pagefind local search. | Generic default violet theme; unorganized flat sidebar dump. |
| **MDN Web Docs** | Semantic rigor: Signature -> Parameters -> Return value -> Exceptions -> Examples. | Strict API symbol template; explicit error contract; browser/runtime support truth. | Deep accordion multi-menus on mobile devices. |

---

## 3. User Tasks & Interaction Budgets

Each task is verifiable via Playwright (`docs:tasks`):
- **T1 (First-Timer Quickstart)**: Docs Home -> click "Quickstart" card -> runnable snippet within 1 screen. Budget: **<= 2 interactions**.
- **T2 (Evaluator Verification)**: Docs Home -> click "Design" in area nav -> click "How correctness is verified". Budget: **<= 3 interactions**.
- **T3 (Engineer Algorithm Selection)**: Docs Home -> click "Choose an algorithm" -> answer 4 traits or read comparison table -> click recommended algorithm. Budget: **<= 3 interactions**.
- **T4 (Integrator Decision Meaning)**: Press `/` or `Ctrl+K` -> search "Decision fields" or "resetAtMs" -> press Enter. Budget: **<= 2 interactions**.
- **T5 (Reviewer ADR Review)**: Docs Home -> click "Design Decisions" -> click latest ADR card. Budget: **<= 2 interactions**.
- **T6 (Contributor Algorithm Authoring)**: Docs Home -> click "Guides" -> click "Write your own algorithm". Budget: **<= 3 interactions**.
- **T7 (Mobile Reader Navigation & TOC)**: Tap mobile menu (1) -> select page (2) -> tap sticky "On this page" (3) -> tap section (4). Budget: **<= 5 taps**.
- **T8 (Keyboard-Only API Symbol Lookup)**: Press `Ctrl+K` -> type `createLimiter` -> arrow down -> Enter. Budget: **0 mouse clicks, <= 4 keystrokes**.
- **T9 (Broken Link Recovery)**: Land on 404 -> click "Documentation Home" button. Budget: **<= 1 interaction**.
- **T10 (Copy Page as Markdown)**: Click "Copy as Markdown" in page chrome -> toast confirmation. Budget: **<= 1 interaction**.

---

## 4. Information Architecture & Sitemap

### 6 Top-Level Areas
- **Start** (4 pages):
  - Introduction (`/`)
  - Quickstart (`/start/quickstart/`)
  - Core Concepts (`/start/core-concepts/`)
  - Tutorial: Your First Limiter (`/start/tutorial-first-limiter/`)
- **Guides** (9 pages):
  - Choose an Algorithm (`/guides/choose-an-algorithm/`)
  - Choose a Key (`/guides/choose-a-key/`)
  - Handle Store Failures (`/guides/handle-store-failures/`)
  - Test Code with Limits (`/guides/testing-limits/`)
  - Change Limits Safely (`/guides/change-limits-safely/`)
  - Cost-Weighted Limits (`/guides/cost-weighted-limits/`)
  - Production Checklist (`/guides/production-checklist/`)
  - Write Your Own Algorithm (`/guides/write-an-algorithm/`)
  - Write Your Own Store (`/guides/write-a-store/`)
- **Algorithms** (5 pages):
  - Overview & Comparison (`/algorithms/`)
  - Token Bucket (`/algorithms/token-bucket/`)
  - Fixed Window Counter (`/algorithms/fixed-window/`)
  - Sliding Window Counter (`/algorithms/sliding-window-counter/`)
  - Sliding Window Log (`/algorithms/sliding-window-log/`)
- **Reference** (7 pages):
  - API Reference (`/reference/api/`)
  - Decision Fields (`/reference/decision-fields/`)
  - Configuration per Algorithm (`/reference/configuration/`)
  - Duration Format (`/reference/duration-format/`)
  - Key Schema & Limits (`/reference/key-schema/`)
  - Error Codes (`/reference/error-codes/`)
  - Glossary (`/reference/glossary/`)
- **Design** (5 pages):
  - Architecture (`/design/architecture/`)
  - How Correctness is Verified (`/design/verification/`)
  - Design Decisions Index (`/design/adr/`)
  - ADR Pages (`/design/adr/0001` - `0019`)
  - Benchmarks & Baselines (`/design/benchmarks/`)
- **Project** (4 pages):
  - Status & Roadmap (`/project/status-roadmap/`)
  - Changelog (`/project/changelog/`)
  - Contributing (`/project/contributing/`)
  - License & Brand Use (`/project/license/`)

---

## 5. Page Templates & Layout

### Templates
1. **Concept**: Context -> mental model -> invariants -> related guides.
2. **Tutorial**: Goal -> prerequisites -> numbered Steps -> runnable verification -> next steps.
3. **Guide**: Task statement -> step-by-step procedures -> real Snippets -> edge case callouts -> next steps.
4. **Algorithm**: Summary -> AtAGlance matrix -> How it works -> Configuration -> Decision field meanings -> Complexity -> PlaygroundEmbed -> When to use.
5. **ADR**: Title, Status, Date, Context, Decision, Consequences, Alternatives, Related links.
6. **API Symbol**: Signature -> Parameters -> Returns -> Throws -> Examples -> See Also.
7. **Reference Table**: Filterable / sortable structured matrix with search anchors.

### Layout Geometry
- **>= 1280px**: 3 columns (Sidebar 280px, Prose 65-72ch with 1.3x breakout for tables, Table of Contents 240px).
- **1024px - 1279px**: 2 columns (Sidebar 280px, Main Content with sticky "On this page" dropdown).
- **< 1024px**: 1 column with slide-out focus-trapped navigation sheet, 44px touch targets.

---

## 6. Search & Relevance

- **Local Pagefind**: Lazy loaded on `Ctrl+K` or `/`.
- **Keyboard support**: Arrow keys, Enter, Esc.
- **Empty state**: Recent searches + 4 suggested entry points.
- **Query set**: 30 verified technical and natural-language queries testing >= 90% top-3 recall.

---

## 7. Component Inventory

- Built-in Starlight primitives styled with `--rx-*` tokens: Aside, Tabs, TabItem, Steps, Card, CardGrid, LinkCard, Badge, FileTree, Code.
- Custom primitives with two-use rule:
  - `StatusChip`: Available / In Progress / Planned status chip tied to `features.ts`.
  - `AtAGlance`: Algorithmic traits matrix (memory, burst, boundaries, exactness, state size).
  - `DecisionFields`: Canonical decision fields table with per-algorithm highlighting.
  - `ConfigTable`: Type-safe configuration option tables.
  - `Snippet`: Snippet pipeline code block with executed output verification.
  - `ApiLink`: Build-validated route link to TSDoc symbol.
  - `PlaygroundEmbed`: Lazy interactive scenario player with static fallback.
  - `Figure`: Semantic figure with caption and accessible focus.
  - `Kbd`: Inline keyboard key representation.

---

## 8. Content System & Ingestion

- **Ingestion Pipeline**: Loads `docs/algorithms/*.md`, `docs/adr/*.md`, `docs/architecture.md`, `docs/benchmarks/*.md`.
- **Link Rewriting**: Transforms markdown relative links (`.md`) to site routes; fails build on broken links.
- **Alert Normalization**: Translates GitHub `> [!NOTE]` alerts to Starlight Asides.
- **Strict Frontmatter Schema**: Validates title, description (max 160 chars), status, area, traits via Zod.
- **Status Gating**: Enforces synchronization between frontmatter status and `features.ts`.
- **Docs Linter**: Enforces style rules (no banned words, sentence case, no em dashes, mandatory code fence languages).

---

## 9. Dependency Strategy (Approved at Gate 1)

- **Zero new third-party plugins**.
- Custom TypeDoc JSON generator for API docs.
- Custom internal crawler for link and anchor validation.
- Custom header area navigation with unified button system.
- Custom static build step for `llms.txt` and `llms-full.txt`.

---

## 10. Performance Budgets

- JS: <= 25 KB gzip (excluding lazy search/playground).
- CSS: <= 30 KB gzip.
- LCP: <= 1.5s, CLS: <= 0.02.
- Lighthouse: Mobile Performance >= 98, Accessibility = 100, Best Practices >= 95.
