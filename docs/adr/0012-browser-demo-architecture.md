# ADR-0012: Browser Demo Architecture and Simulated Clock

## Status

Accepted

## Context

Interactive rate limiter demos often use mock algorithms or call remote server APIs to show how rate limiting works. Both approaches have significant flaws:

- Mock implementations risk drifting from real behavior, presenting bugs or inaccurate semantics to users.
- Server APIs introduce network latency, rate limit the demo itself, require backend infrastructure, and fail when offline.

Because `@reqnx/core` is dependency-free, portable, and decoupled from system time via the `Clock` interface ([ADR-0001](file:///d:/zynorex%20Github/reqnx/docs/adr/0001-package-boundaries.md)), it can execute entirely inside a web browser.

## Decisions

### 1. Execute real `@reqnx/core` in the browser

All interactive demos in `apps/site` run the actual `@reqnx/core` library code compiled to JavaScript. The browser instantiates real instances of:

- `createMemoryStore({ clock })`
- `createLimiter({ algorithm, store, prefix, config })`
- Real algorithm state machines (e.g. `fixedWindow`)

There are zero mock algorithm implementations, and no HTTP requests are sent to a server.

### 2. BrowserFakeClock for deterministic control

To allow instant replaying of scenarios spanning seconds or minutes (e.g. testing a 1-minute window rollover or a boundary burst) without waiting in real time:

- We implement `BrowserFakeClock` implementing the `Clock` interface.
- Time is advanced explicitly (`clock.advance(ms)`) under scenario control.
- `@reqnx/testkit` is intentionally NOT imported into the site bundle to keep production and documentation builds decoupled from private test infrastructure.

### 3. Clear simulated disclosure

To prevent confusion with live production rate limiters, every interactive component prominently displays:

> "⏱ Simulated — uses a fake clock, not real time. Runs the real @reqnx/core library."

### 4. ScenarioEngine abstraction

Scenarios are expressed as declarative arrays of actions (`delayMs`, `key`, `cost`). A unified `ScenarioEngine` supports both full headless execution (`runAll()`) and animated step-by-step playback (`step()`) for interactive UI timelines.

## Consequences

- Demo correctness is guaranteed by the core library's actual implementation.
- Visitors can experiment with boundary bursts, quota recovery, and multi-key isolation instantly without artificial network lag.
- The browser bundle remains small, portable, and safe from Node-specific native bindings.
