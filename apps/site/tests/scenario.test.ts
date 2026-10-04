import { describe, it, expect } from 'vitest';
import { createBrowserFakeClock } from '../src/engine/fake-clock';
import { createScenarioEngine } from '../src/engine/scenario';
import {
  fixedWindowBurst,
  fixedWindowRollover,
  fixedWindowBoundaryBurst,
  fixedWindowMultiKey,
} from '../src/engine/presets';

describe('BrowserFakeClock', () => {
  it('initialises at startMs', () => {
    const clock = createBrowserFakeClock(1000);
    expect(clock.nowMs()).toBe(1000);
  });

  it('advances time monotonically', () => {
    const clock = createBrowserFakeClock(0);
    clock.advance(500);
    expect(clock.nowMs()).toBe(500);
    clock.advance(250);
    expect(clock.nowMs()).toBe(750);
  });

  it('throws on negative advance', () => {
    const clock = createBrowserFakeClock(100);
    expect(() => clock.advance(-50)).toThrow('Cannot advance clock by negative milliseconds');
  });

  it('resets to initial startMs', () => {
    const clock = createBrowserFakeClock(500);
    clock.advance(1000);
    expect(clock.nowMs()).toBe(1500);
    clock.reset();
    expect(clock.nowMs()).toBe(500);
  });
});

describe('ScenarioEngine', () => {
  it('runs fixedWindowBurst preset and reports correct allowed/denied counts', async () => {
    const engine = createScenarioEngine(fixedWindowBurst);
    const result = await engine.runAll();

    expect(result.summary.total).toBe(7);
    expect(result.summary.allowed).toBe(5);
    expect(result.summary.denied).toBe(2);
    expect(result.steps.length).toBe(7);

    // First 5 allowed
    for (let i = 0; i < 5; i++) {
      expect(result.steps[i]!.decision.allowed).toBe(true);
      expect(result.steps[i]!.decision.remaining).toBe(4 - i);
    }

    // Last 2 denied
    expect(result.steps[5]!.decision.allowed).toBe(false);
    expect(result.steps[5]!.decision.remaining).toBe(0);
    expect(result.steps[6]!.decision.allowed).toBe(false);
  });

  it('runs fixedWindowRollover preset and recovers quota after window', async () => {
    const engine = createScenarioEngine(fixedWindowRollover);
    const result = await engine.runAll();

    expect(result.summary.total).toBe(8);
    expect(result.summary.allowed).toBe(8);
    expect(result.summary.denied).toBe(0);

    // Step 5 (index 5) is the first request after 10s rollover
    const rolloverStep = result.steps[5]!;
    expect(rolloverStep.decision.allowed).toBe(true);
    expect(rolloverStep.decision.remaining).toBe(4);
  });

  it('demonstrates boundary burst allowing 10 requests across boundary', async () => {
    const engine = createScenarioEngine(fixedWindowBoundaryBurst);
    const result = await engine.runAll();

    expect(result.summary.total).toBe(10);
    expect(result.summary.allowed).toBe(10);
    expect(result.summary.denied).toBe(0);
  });

  it('isolates keys in multiKey preset', async () => {
    const engine = createScenarioEngine(fixedWindowMultiKey);
    const result = await engine.runAll();

    expect(result.summary.total).toBe(8);
    expect(result.summary.allowed).toBe(6); // 3 alice + 3 bob
    expect(result.summary.denied).toBe(2); // 1 alice + 1 bob
  });

  it('supports step-by-step execution and reset', async () => {
    const engine = createScenarioEngine(fixedWindowBurst);

    expect(engine.done).toBe(false);
    expect(engine.steps.length).toBe(0);

    const step1 = await engine.step();
    expect(step1).not.toBeNull();
    expect(step1?.index).toBe(0);
    expect(step1?.decision.allowed).toBe(true);
    expect(engine.steps.length).toBe(1);

    engine.reset();
    expect(engine.done).toBe(false);
    expect(engine.steps.length).toBe(0);
    expect(engine.currentMs).toBe(0);
  });
});
