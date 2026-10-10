import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { rollNumber } from '../src/motion/odometer.js';
import { setMotionPreference } from '../src/motion/kill-switch.js';

interface MockElement {
  tagName: string;
  className: string;
  _textContent: string;
  children: MockElement[];
  style: Record<string, string>;
  attributes: Record<string, string>;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  appendChild(child: MockElement): MockElement;
  textContent: string;
  innerHTML: string;
  querySelector(sel: string): MockElement | null;
  querySelectorAll(sel: string): MockElement[];
}

function createMockElement(tagName: string): MockElement {
  const el: MockElement = {
    tagName: tagName.toUpperCase(),
    className: '',
    _textContent: '',
    children: [],
    style: {},
    attributes: {},
    setAttribute(k: string, v: string) {
      this.attributes[k] = v;
    },
    getAttribute(k: string) {
      return this.attributes[k] ?? null;
    },
    appendChild(child: MockElement) {
      this.children.push(child);
      return child;
    },
    get textContent(): string {
      if (this.children.length > 0) {
        return this.children.map((c) => c.textContent).join('');
      }
      return this._textContent;
    },
    set textContent(val: string) {
      this._textContent = val;
      this.children = [];
    },
    set innerHTML(val: string) {
      if (val === '') {
        this.children = [];
        this._textContent = '';
      }
    },
    querySelector(sel: string): MockElement | null {
      return this.querySelectorAll(sel)[0] ?? null;
    },
    querySelectorAll(sel: string): MockElement[] {
      const results: MockElement[] = [];
      const match = (item: MockElement) => {
        if (sel.startsWith('.')) {
          const cls = sel.slice(1);
          return item.className.split(/\s+/).includes(cls);
        }
        return false;
      };
      for (const child of this.children) {
        if (match(child)) results.push(child);
        results.push(...child.querySelectorAll(sel));
      }
      return results;
    },
  };
  return el;
}

describe('Accessible Odometer Roller (rollNumber)', () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
  };

  const mockDoc = {
    documentElement: {
      dataset: {} as Record<string, string>,
    },
    createElement: (tag: string) => createMockElement(tag),
  };

  const globalScope = globalThis as unknown as {
    window?: unknown;
    document?: unknown;
    localStorage?: unknown;
    requestAnimationFrame?: unknown;
  };

  beforeEach(() => {
    store.clear();
    mockDoc.documentElement.dataset = {};
    const mockWindow = {
      matchMedia: () => ({ matches: false }),
      dispatchEvent: () => true,
      requestAnimationFrame: (cb: () => void) => {
        cb();
        return 1;
      },
    };
    globalScope.window = mockWindow;
    globalScope.document = mockDoc;
    globalScope.localStorage = mockLocalStorage;
    globalScope.requestAnimationFrame = mockWindow.requestAnimationFrame;
  });

  afterEach(() => {
    delete globalScope.window;
    delete globalScope.document;
    delete globalScope.localStorage;
    delete globalScope.requestAnimationFrame;
  });

  it('renders aria-hidden visual column and screen-reader accessible final value', () => {
    setMotionPreference('system');
    mockDoc.documentElement.dataset.motion = 'full';

    const container = mockDoc.createElement('div');
    rollNumber(container as unknown as HTMLElement, 257);

    // Screen reader accessible final text
    const srSpan = container.querySelector('.sr-only');
    expect(srSpan).not.toBeNull();
    expect(srSpan?.textContent).toBe('257');

    // Visual animated container is aria-hidden
    const visualContainer = container.querySelector('.rx-odometer-visual');
    expect(visualContainer).not.toBeNull();
    expect(visualContainer?.getAttribute('aria-hidden')).toBe('true');

    // Has 3 digit columns
    const cols = visualContainer?.querySelectorAll('.rx-odometer-col');
    expect(cols?.length).toBe(3);
  });

  it('renders final static text immediately under reduced motion', () => {
    setMotionPreference('reduced');
    mockDoc.documentElement.dataset.motion = 'reduced';

    const container = mockDoc.createElement('div');
    rollNumber(container as unknown as HTMLElement, '100%');

    expect(container.textContent).toBe('100%');
    expect(container.querySelector('.rx-odometer-col')).toBeNull();

    // Reset preference
    setMotionPreference('system');
  });
});
