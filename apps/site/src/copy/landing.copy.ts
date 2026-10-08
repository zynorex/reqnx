// ──────────────────────────────────────────────────────────────────────────────
// apps/site/src/copy/landing.copy.ts
//
// Authoritative copy deck for REQNX Landing Page v2 and 404.
// Strict compliance: No marketing hype words, no exclamation points,
// no emojis, developer-to-developer plain language.
// ──────────────────────────────────────────────────────────────────────────────

export interface HeadlineOption {
  readonly id: string;
  readonly headline: string;
  readonly subhead: string;
  readonly isPrimary?: boolean;
}

export interface FaqItem {
  readonly slug: string;
  readonly question: string;
  readonly answer: string;
}

export interface FaqCategory {
  readonly category: string;
  readonly items: readonly FaqItem[];
}

export const landingCopy = {
  header: {
    navDocs: 'Docs',
    navAlgorithms: 'Algorithms',
    navPlayground: 'Playground',
    navStatus: 'Status',
    navGithub: 'GitHub',
    getStartedCta: 'Get started',
  },

  hero: {
    eyebrow: 'Open source · MIT · v0.x',
    headlineOptions: [
      {
        id: 'small-parts',
        headline: 'Rate limiting built from small, checkable parts.',
        subhead:
          'Zero runtime dependencies. Pure state-transition functions. Injected clocks and atomic stores so your tests and callers always agree.',
        isPrimary: true,
      },
      {
        id: 'reason-about',
        headline: 'Predictable rate limiting you can reason about.',
        subhead:
          'Five classical algorithms, one strict contract, and zero floating-point drift. Runs where JavaScript runs, backed by atomic concurrency tests.',
        isPrimary: false,
      },
      {
        id: 'no-guesswork',
        headline: 'Rate limiting without the guesswork.',
        subhead:
          'Every check returns whether the call is allowed, how much is left, when the limit resets, and how long to wait.',
        isPrimary: false,
      },
      {
        id: 'pluggable',
        headline: 'Pluggable rate limiting for Node.js and TypeScript.',
        subhead:
          'Decoupled algorithms and atomic stores. Test without sleeping, deploy without hidden race conditions.',
        isPrimary: false,
      },
      {
        id: 'calibrated',
        headline: 'Calibrated rate limiting for distributed APIs.',
        subhead:
          'Pure step functions running against memory or Redis. Deterministic, inspectable, and zero dependencies.',
        isPrimary: false,
      },
    ] as readonly HeadlineOption[],
    headline: 'Rate limiting built from small, checkable parts.',
    subhead:
      'Zero runtime dependencies. Pure state-transition functions. Injected clocks and atomic stores so your tests and callers always agree.',
    ctaPrimary: 'Get started',
    ctaSecondary: 'Try the playground',
    fromSourceLabel: 'Run it from source',
    installLabel: 'Install package',
    simulatedCaption:
      'Simulated time. This is the real @reqnx/core library running in your browser.',
  },

  proofStrip: {
    title: 'Verified project facts',
    howComputedTitle: 'How these numbers are computed',
    howComputedLede:
      'Every statistic in this strip is computed directly from the repository source code and benchmark files at site build time. If an artifact is missing, its fact is omitted.',
  },

  whatItIs: {
    eyebrow: 'What it is',
    title: 'A rate limiter built from small, checkable parts.',
    lede:
      'It decides, for each request, whether a caller is within their quota. You select an algorithm and a store; it returns a decision your application and your callers can act on.',
    theDecisionTitle: 'The decision contract',
    theDecisionLede:
      'Every check returns a structured decision object computed in a single atomic step.',
    fields: [
      {
        name: 'allowed',
        type: 'boolean',
        description: 'True if the request is admitted within quota; false if rejected.',
      },
      {
        name: 'remaining',
        type: 'number',
        description: 'Remaining request units permitted within the current span.',
      },
      {
        name: 'resetAtMs',
        type: 'number',
        description: 'Epoch millisecond timestamp when the current window resets or refills.',
      },
      {
        name: 'retryAfterMs',
        type: 'number',
        description: 'Milliseconds the client must wait before retrying when rejected.',
      },
      {
        name: 'limit',
        type: 'number',
        description: 'The maximum capacity configured for this key and span.',
      },
    ],
    whyHardTitle: 'Why exact rate limiting is hard',
    challenges: [
      {
        id: 'time',
        title: 'Time and drift',
        problem:
          'System clocks jump backward during NTP syncs, and servers in a cluster do not agree on the current millisecond.',
        solution:
          'Algorithms never read the system clock directly. Time is injected as an explicit integer, and window resets anchor to epoch intervals.',
        link: 'docs/adr/0002-algorithm-contract-and-atomicity.md',
      },
      {
        id: 'concurrency',
        title: 'Race conditions',
        problem:
          'Two simultaneous requests can both observe one token remaining and both deduct it, allowing traffic past the quota.',
        solution:
          'Check, algorithm step, and state persistence execute as a single atomic operation in MemoryStore and in Redis Lua scripts.',
        link: 'docs/adr/0002-algorithm-contract-and-atomicity.md',
      },
      {
        id: 'failure',
        title: 'Store unavailability',
        problem:
          'When Redis disconnects or a store crashes, uncaught errors crash process handlers or block legitimate traffic.',
        solution:
          'Configurable failure policies (fail-open, fail-closed, custom fallback) isolate store errors and tag degraded decisions clearly.',
        link: 'docs/adr/0004-failure-semantics.md',
      },
    ],
    whoItsForTitle: "Who it's for",
    whoItsForPoints: [
      'Backend engineers building Node.js and TypeScript APIs that need deterministic rate limiting.',
      'Teams requiring verifiable concurrency guarantees across both single-process and distributed Redis tiers.',
      'Developers who write automated tests and cannot tolerate sleeping in test suites.',
    ],
  },

  whyChoose: {
    eyebrow: 'Why choose it',
    title: 'Reasons you can check',
    lede:
      'Every guarantee links directly to an automated test, an architectural decision record, or a pure function in the repository.',
    whereItFitsTitle: 'Where it fits',
    whereItFitsLede:
      'Coarse network attacks belong at the edge or CDN. Business rate limiting belongs inside your application layer alongside your domain logic.',
    notTheRightToolTitle: 'Not the right tool if',
    notTheRightToolPoints: [
      'You need protection against massive volumetric DDoS attacks (enforce those at your CDN or edge WAF).',
      'You require proxy-level rate limiting in NGINX or Envoy without writing application code.',
      'Your backend stack is written in Go, Rust, or Python (Reqnx is TypeScript/Node.js).',
      'You want a hosted third-party SaaS dashboard with managed billing and credit-card quotas.',
      'You need requests queued and throttled for deferred processing rather than immediately admitted or rejected.',
    ],
  },

  theSeam: {
    eyebrow: 'Algorithm mechanics',
    title: 'Fixed windows have a seam',
    lede:
      'Rigid window boundaries allow traffic concentrated at the boundary to consume twice the limit in a fraction of a second.',
    figureCaption:
      'With limit 5 per 10s: 5 requests land right before the 10.0s boundary, and 5 more land right after. Ten requests are admitted in 80 milliseconds.',
    mitigation:
      'This behavior is mathematically intrinsic to fixed windows. To eliminate boundary bursts, switch to continuous Token Bucket or Sliding Window Counter.',
  },

  algorithms: {
    eyebrow: 'Algorithms',
    title: 'Five classical strategies',
    lede:
      'Select the right trade-off between throughput, memory footprint, and burst tolerance. Adding an algorithm requires zero modifications to existing components.',
    tradeoffMatrixTitle: 'Conceptual properties, not measurements',
    selectionGuide: [
      'Use Fixed Window Counter for raw throughput when brief 2x boundary spikes are harmless.',
      'Use Token Bucket when callers send legitimate bursty traffic that should refill smoothly.',
      'Use Sliding Window Counter for strict rolling quotas with minimal memory overhead.',
      'Use Sliding Window Log when exact rolling timestamp auditing is mandatory.',
      'Use Leaky Bucket when downstream dependencies require smooth, constant-rate request processing.',
    ],
  },

  quickstart: {
    eyebrow: 'Quickstart',
    title: 'From zero to an enforced rate limit',
    lede:
      'Create a store, configure an algorithm, and check callers. The output on the right is generated by running this exact snippet in Node.js.',
    steps: [
      'Install @reqnx/core using your preferred package manager.',
      'Instantiate MemoryStore and select an algorithm.',
      'Evaluate request keys and pass or reject callers based on the returned Decision.',
    ],
    outputTitle: 'Verified output',
    outputCaption: 'Produced by running this snippet during site build.',
  },

  recipes: {
    eyebrow: 'Recipes',
    title: 'Common limits, ready to adapt',
    lede:
      'Tested configurations for common API patterns, with real decisions produced by the library runtime.',
    keyChoiceNote:
      'Always rate limit on authenticated user IDs or API keys where possible. Do not trust forwarded IP headers (X-Forwarded-For) without verifying that your reverse proxy strips spoofed client headers.',
  },

  architecture: {
    eyebrow: 'Architecture',
    title: 'Data flow and separation of concerns',
    lede:
      'The limiter validates parameters and handles failure; the store guarantees atomic execution; the algorithm is a pure state machine without I/O or clock dependencies.',
    worksWithTitle: 'Works with',
  },

  status: {
    eyebrow: 'Implementation progress',
    title: 'What works today',
    lede:
      'Every item links to the code or test behind it. Features are marked available only when passing tests exist on disk.',
    notYetVerifiedTitle: 'Not yet verified',
    notYetVerifiedPoints: [
      'Multi-node Redis Cluster and Valkey failover behaviors are designed but not yet integration tested.',
      'Distributed Lua scripts under sustained multi-instance network latency are scheduled for Day 6.',
      'Express and Fastify framework middleware packages are in stub status until Day 7.',
    ],
  },

  faq: {
    eyebrow: 'Frequently asked questions',
    title: 'Questions and technical answers',
    lede:
      'Concrete answers to technical and operational questions, grounded in library design and recorded decisions.',
    categories: [
      {
        category: 'Getting started',
        items: [
          {
            slug: 'need-redis',
            question: 'Do I need Redis to use this library?',
            answer:
              'No. For single-process services, background workers, or edge functions, MemoryStore provides synchronous in-memory rate limiting with LRU eviction and memory bounds.',
          },
          {
            slug: 'which-algorithm',
            question: 'Which algorithm should I choose for my API?',
            answer:
              'Fixed Window Counter offers the highest raw throughput when momentary boundary bursts are acceptable. For steady API traffic with burst tolerance, choose Token Bucket.',
          },
          {
            slug: 'which-key',
            question: 'What key should I rate limit on (IP, user ID, API key)?',
            answer:
              'Rate limit on authenticated tenant IDs or API keys whenever possible. Use client IP addresses only for unauthenticated endpoints, and only behind trusted reverse proxies.',
          },
          {
            slug: 'frameworks',
            question: 'Which web frameworks are supported?',
            answer:
              '@reqnx/core works in any JavaScript runtime. First-party Express middleware and Fastify plugins are planned for Day 7.',
          },
        ],
      },
      {
        category: 'Design & Mechanics',
        items: [
          {
            slug: 'clock-drift',
            question: 'How does the library handle clock drift and NTP jumps?',
            answer:
              'Per ADR-0002 and ADR-0010, the algorithm locks onto stored window timestamps and never grants early quota renewal if the system clock jumps backward.',
          },
          {
            slug: 'concurrency',
            question: 'Is the check safe under high concurrent traffic?',
            answer:
              'Yes. Check and state update occur in a single atomic step within MemoryStore and within Redis Lua scripts, preventing race conditions where multiple requests both deduct the last token.',
          },
          {
            slug: 'store-failure',
            question: 'What happens if the backing store fails or disconnects?',
            answer:
              'The limiter facade applies configurable failure policies: fail-open (default, returns degraded: true), fail-closed, or a custom error handler. Store errors never crash your process.',
          },
          {
            slug: 'redis-cluster',
            question: 'Does it work with Redis Cluster or Valkey?',
            answer:
              'Keys use hash tags ({tenant:user}) to ensure all keys for an identity map to the same Redis Cluster hash slot. Full cluster integration tests run on Day 6.',
          },
          {
            slug: 'edge-runtimes',
            question: 'Can this run in the browser or on Cloudflare Workers?',
            answer:
              'Yes. @reqnx/core has zero runtime dependencies and uses no Node-specific APIs. It runs directly in Node.js, Bun, Deno, Cloudflare Workers, and in modern browsers.',
          },
        ],
      },
      {
        category: 'Production & Operations',
        items: [
          {
            slug: 'production-status',
            question: 'Can I use this library in production today?',
            answer:
              'The core package is in pre-release v0.x. Fixed Window Counter and Token Bucket with MemoryStore are tested with extensive unit, property, and model suites. Distributed Redis integration arrives on Day 6.',
          },
          {
            slug: 'throughput',
            question: 'How fast is the library in throughput benchmarks?',
            answer:
              'In local benchmarks on a single thread (12th Gen Intel i5-12500H, Node v24.12.0), MemoryStore processes over 520,000 checks per second for Fixed Window and 550,000 checks per second for Token Bucket.',
          },
          {
            slug: 'testing',
            question: 'How do I test application code that uses rate limiting?',
            answer:
              'Pass a FakeClock from the testkit into the store. You can advance simulated time by milliseconds without sleeping in your test runners.',
          },
          {
            slug: 'observability',
            question: 'How do I observe decisions and rate limit events in production?',
            answer:
              'Register onDecision and onError hooks on the limiter instance. Hooks execute safely without blocking or altering the caller decision.',
          },
        ],
      },
      {
        category: 'Project & Governance',
        items: [
          {
            slug: 'custom-algorithm',
            question: 'How do I implement a custom algorithm or store?',
            answer:
              'Implement the pure Algorithm or Store interface. You can validate compliance against the formal specification using the testkit contract suites.',
          },
          {
            slug: 'brand-policy',
            question: 'May I use the Reqnx logo and mascot in my documentation?',
            answer:
              'The Reqnx software is MIT-licensed. Brand assets (logo, mascot, character art) are copyright the project maintainers, reserved for official distribution, and require permission for external branding.',
          },
          {
            slug: 'contributing',
            question: 'How can I contribute to the project?',
            answer:
              'Check the open issues on GitHub, review the architectural decision records in docs/adr/, and submit pull requests with accompanying tests.',
          },
        ],
      },
    ],
  },

  openSource: {
    eyebrow: 'Open source',
    title: 'Open source, MIT, built in the open',
    lede:
      'Code is developed with public commits, transparent architectural records, and comprehensive automated test suites.',
    recentDecisionsTitle: 'Recent architectural decisions',
    viewAllDecisions: 'View all architectural decisions',
  },

  ctaBand: {
    title: 'Try it before you install it',
    lede:
      'Run the interactive playground in your browser, explore the algorithm specifications, or inspect the source code on GitHub.',
    primary: 'Read the quickstart',
    secondary: 'Open the playground',
    github: 'View repository on GitHub',
  },

  footer: {
    brandLicenseNote:
      'Software licensed under MIT. Reqnx logo, mascot, and character illustrations are copyright the project maintainers.',
    trademarkNotice:
      'Redis is a registered trademark of Redis Ltd. Express and Fastify are trademarks of their respective owners. REQNX has no official affiliation with these projects.',
    trackingNotice: 'No cookies. No tracking.',
  },

  notFound: {
    eyebrow: 'Error 404',
    headlineOptions: [
      'This route has been dropped.',
      '404: Window expired.',
      'Page not found.',
    ],
    headline: 'This route has been dropped.',
    subhead:
      'The requested page does not exist or has been moved to another location.',
    backHomeCta: 'Back to home',
    docsLink: 'Documentation',
    algorithmsLink: 'Algorithms',
    playgroundLink: 'Playground',
    reportBrokenLink: 'Report a broken link',
  },
} as const;

export const copyDeck = landingCopy;

