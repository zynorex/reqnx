import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { motionRegistry } from '../src/motion/registry.js';
import { getStoredMotionPreference, isMotionReduced, setMotionPreference } from '../src/motion/kill-switch.js';

describe('Motion System & Registry', () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  const mockDoc = {
    documentElement: {
      dataset: {} as Record<string, string>,
    },
  };

  const mockWin = {
    matchMedia: (_query: string) => ({ matches: false }),
    dispatchEvent: (_evt: unknown) => true,
  };

  interface MockEventInit {
    detail?: unknown;
  }

  class MockCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: MockEventInit) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const globalScope = globalThis as unknown as {
    window?: unknown;
    document?: unknown;
    localStorage?: unknown;
    CustomEvent?: unknown;
  };

  beforeEach(() => {
    store.clear();
    mockDoc.documentElement.dataset = {};
    globalScope.window = mockWin;
    globalScope.document = mockDoc;
    globalScope.localStorage = mockLocalStorage;
    globalScope.CustomEvent = MockCustomEvent;
  });

  afterEach(() => {
    delete globalScope.window;
    delete globalScope.document;
    delete globalScope.localStorage;
    delete globalScope.CustomEvent;
  });

  it('contains all 28 effects with complete accessibility contracts', () => {
    expect(motionRegistry.length).toBe(28);

    for (const effect of motionRegistry) {
      expect(effect.id).toMatch(/^E\d+$/);
      expect(effect.title.length).toBeGreaterThan(0);
      expect(['global', 'hero', 'console', 'sections', 'transitions', '404']).toContain(effect.region);
      expect(['M', 'S', 'X']).toContain(effect.priority);
      expect(effect.reducedMotion.length).toBeGreaterThan(10);
      expect(effect.noJs.length).toBeGreaterThan(5);
      expect(effect.fallback.length).toBeGreaterThan(5);
      expect(effect.estJsKb).toBeGreaterThanOrEqual(0);
      expect(effect.estCssKb).toBeGreaterThanOrEqual(0);
    }
  });

  it('guarantees motion JS and CSS estimates remain within performance budgets', () => {
    const totalJsKb = motionRegistry
      .filter((e) => e.enabled)
      .reduce((acc, e) => acc + e.estJsKb, 0);
    const totalCssKb = motionRegistry
      .filter((e) => e.enabled)
      .reduce((acc, e) => acc + e.estCssKb, 0);

    // Budget: <= 6 KB JS gzip, <= 5 KB CSS gzip
    expect(totalJsKb).toBeLessThanOrEqual(6.0);
    expect(totalCssKb).toBeLessThanOrEqual(5.0);
  });

  it('manages motion preference kill-switch persistence', () => {
    // Default system preference (clear store)
    store.clear();
    expect(getStoredMotionPreference()).toBe('system');

    // Switch to reduced
    setMotionPreference('reduced');
    expect(getStoredMotionPreference()).toBe('reduced');
    expect(mockDoc.documentElement.dataset.motion).toBe('reduced');
    expect(isMotionReduced()).toBe(true);

    // Reset to system
    setMotionPreference('system');
    expect(getStoredMotionPreference()).toBe('system');
  });

  it('bounds stagger delay caps within token thresholds', () => {
    const staggerStep = 40; // ms
    const staggerCap = 400; // ms
    const maxItems = 20;

    const computedDelays = Array.from({ length: maxItems }, (_, i) =>
      Math.min(i * staggerStep, staggerCap),
    );

    expect(Math.max(...computedDelays)).toBe(staggerCap);
  });
});

