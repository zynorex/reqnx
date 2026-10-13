---
title: "ADR-0012: Browser Demo Architecture and Simulated Clock"
description: "ADR-0012: Browser Demo Architecture and Simulated Clock documentation."
area: "design"
status: "available"
order: 12
---

<!-- @generated from docs/adr/0012-browser-demo-architecture.md - DO NOT EDIT DIRECTLY -->

<div class="rx-adr-card rx-panel">
  <div class="rx-adr-header">
    <div class="rx-adr-id-group">
      <span class="rx-adr-badge">ADR-0012</span>
      <div class="rx-adr-title">ADR-0012: Browser Demo Architecture and Simulated Clock</div>
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

Interactive rate limiter demos often use mock algorithms or call remote server APIs to show how rate limiting works. Both approaches have significant flaws:

- Mock implementations risk drifting from real behavior, presenting bugs or inaccurate semantics to users.
- Server APIs introduce network latency, rate limit the demo itself, require backend infrastructure, and fail when offline.

Because `@reqnx/core` is dependency-free, portable, and decoupled from system time via the `Clock` interface ([ADR-0001](/design/adr/0001-package-boundaries/)), it can execute entirely inside a web browser.

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

> "⏱ Simulated  -  uses a fake clock, not real time. Runs the real @reqnx/core library."

### 4. ScenarioEngine abstraction

Scenarios are expressed as declarative arrays of actions (`delayMs`, `key`, `cost`). A unified `ScenarioEngine` supports both full headless execution (`runAll()`) and animated step-by-step playback (`step()`) for interactive UI timelines.

## Consequences

- Demo correctness is guaranteed by the core library's actual implementation.
- Visitors can experiment with boundary bursts, quota recovery, and multi-key isolation instantly without artificial network lag.
- The browser bundle remains small, portable, and safe from Node-specific native bindings.
