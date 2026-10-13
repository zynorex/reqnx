# REQNX Documentation Style Guide

This style guide establishes writing standards, terminology, and structural requirements for all REQNX documentation. These rules are enforced by `pnpm --filter @reqnx/site docs:lint` and CI gates.

---

## 1. Tone and Voice

- **Perspective**: Second person ("you", "your"). Address the reader directly.
- **Tense**: Present tense ("calls", "returns", "evaluates").
- **Voice**: Active voice ("The store evicts oldest keys", not "Oldest keys are evicted by the store").
- **Sentence Structure**: Keep sentences short and direct. State what to do first, then explain why.
- **Directness**: State behaviors and trade-offs factually. Never gloss over edge cases or unverified behaviors.

---

## 2. Banned Words and Punctuation

To maintain technical credibility and calm reading flow, the following are banned:

### Minimising Words (Banned)
Never minimize technical effort or operational risk.
- `simply`
- `just`
- `easy`
- `easily`
- `obviously`
- `of course`
- `trivial`

### Marketing Hype (Banned)
Never use superlative or unsubstantiated marketing phrases:
- `blazing`
- `seamless`
- `powerful`
- `effortless`
- `robust`
- `revolutionary`
- `next-generation`
- `supercharge`
- `unlock`
- `leverage`
- `world-class`
- `production-ready`
- `battle-tested`
- `enterprise-grade`

### Punctuation and Formatting Bans
- **No exclamation marks**: State facts plainly without emotional inflection.
- **No em dashes**: Use commas, parentheses, or separate sentences instead of em dashes.
- **No emoji**: Maintain clean typographic clarity.
- **No uninformative link text**: Avoid "here", "click here", "link", or "read more". Links must name their destination target.

---

## 3. Canonical Terminology

Capitalize and format technical concepts consistently:

| Term | Format | Definition |
| :--- | :--- | :--- |
| **Decision** | Capitalized noun | The immutable result object returned by `limiter.check()`. Contains `admitted`, `remaining`, `resetAtMs`, and `retryAfterMs`. |
| **Limiter** | Capitalized noun | The coordinated instance created by `createLimiter()`. |
| **Store** | Capitalized noun | Storage backend implementing the atomic store contract (e.g., `MemoryStore`). |
| **Algorithm** | Capitalized noun | Mathematical stepping function (e.g., `TokenBucket`, `FixedWindow`). |
| **key** | Lowercase noun | The string identifying a rate limit partition (e.g., `ip:127.0.0.1`, `user:usr_123`). |
| **window** | Lowercase noun | The duration over which quota is budgeted or elapsed. |
| **cost** | Lowercase noun | The positive integer weight deducted by a request. |

---

## 4. Page Structure Standards

### Frontmatter Requirements
Every documentation page must specify frontmatter validated against `docsSchema`:
- `title`: Concise, sentence-case title.
- `description`: A single sentence of at most 160 characters summarizing the page.
- `status`: One of `available`, `in-progress`, or `planned`. Must match `features.ts`.
- `area`: One of `start`, `guides`, `algorithms`, `reference`, `design`, `project`.

### Section and Heading Hierarchy
- **Sentence-case headings**: Capitalize only the first word and proper nouns (e.g., "Handle store failures", "Choose an algorithm").
- **Depth**: Maximum three levels of headings below the page title (`h2`, `h3`, `h4`). Never use `h5` or `h6`.
- **One idea per section**: Break complex discussions into focused subsections.

### Guides and Tutorials
- **Prerequisites**: Every tutorial and guide must state prerequisites at the top before instructions begin.
- **Numbered steps**: Use `<Steps>` for sequential actions.
- **Next steps**: Every guide must end with a "Next steps" section offering links to relevant follow-up pages.

---

## 5. Code Presentation and Verifiability

- **Real code rule**: Every code example claiming to show functional usage must correspond to a real snippet file in `src/snippets/` executed and verified by CI.
- **Illustrative blocks**: Pseudo-code, schema fragments, or partial snippets must carry an explicit comment or badge indicating they are illustrative.
- **Language specification**: Every code fence must specify a syntax highlighting language (`typescript`, `bash`, `json`, `text`).
- **File titles**: Code blocks representing distinct files must specify a title.

---

## 6. Claims and Evidence

- Factual claims regarding performance, memory bounds, or guarantees must trace to an entry in `src/data/claims.ts` or link directly to evidence in the repository.
- Avoid unsubstantiated absolute words ("always", "never", "guaranteed") without linking to property tests, contract suites, or mathematical proofs.
- If a capability is unverified or under active development, say so plainly.
