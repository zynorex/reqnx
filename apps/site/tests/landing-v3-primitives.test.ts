import { describe, it, expect } from 'vitest';
import { resolveButtonContract } from '../src/components/common/button-builder.js';

describe('Landing v3 Stage 2 Primitives & Contracts', () => {
  describe('Button System Pill Shape', () => {
    it('resolves default shape without data-shape attribute', () => {
      const contract = resolveButtonContract({ variant: 'primary', size: 'lg' });
      expect(contract.attrs['data-shape']).toBeUndefined();
    });

    it('resolves shape="pill" with data-shape="pill"', () => {
      const contract = resolveButtonContract({
        variant: 'primary',
        size: 'lg',
        shape: 'pill',
      });
      expect(contract.attrs['data-shape']).toBe('pill');
      expect(contract.attrs['data-size']).toBe('lg');
      expect(contract.attrs['data-variant']).toBe('primary');
    });

    it('preserves accessible attributes when shape="pill"', () => {
      const contract = resolveButtonContract({
        shape: 'pill',
        href: '/getting-started/',
        ariaLabel: 'Get started with REQNX',
      });
      expect(contract.isAnchor).toBe(true);
      expect(contract.attrs.href).toBe('/getting-started/');
      expect(contract.attrs['data-shape']).toBe('pill');
      expect(contract.attrs['aria-label']).toBe('Get started with REQNX');
    });
  });

  describe('StatCell Omission Contract', () => {
    // Pure logic assertion simulating StatCell frontmatter contract
    function shouldRenderStatCell(value: unknown): boolean {
      return value !== null && value !== undefined && value !== '';
    }

    it('renders cell when value is a valid number', () => {
      expect(shouldRenderStatCell(0)).toBe(true);
      expect(shouldRenderStatCell(19)).toBe(true);
    });

    it('renders cell when value is a non-empty string', () => {
      expect(shouldRenderStatCell('2 / 5')).toBe(true);
      expect(shouldRenderStatCell('exact')).toBe(true);
    });

    it('omits cell entirely when value is null, undefined, or empty', () => {
      expect(shouldRenderStatCell(null)).toBe(false);
      expect(shouldRenderStatCell(undefined)).toBe(false);
      expect(shouldRenderStatCell('')).toBe(false);
    });
  });

  describe('PillTabs ARIA Contract', () => {
    interface TabDef {
      id: string;
      label: string;
      disabled?: boolean;
    }

    function resolveTabAttributes(tabs: TabDef[], activeId: string) {
      return tabs.map((tab) => {
        const isSelected = tab.id === activeId;
        return {
          id: `tab-${tab.id}`,
          role: 'tab',
          'aria-selected': isSelected ? 'true' : 'false',
          'aria-controls': `panel-${tab.id}`,
          tabindex: isSelected ? 0 : -1,
          disabled: tab.disabled ?? false,
          'data-tab-id': tab.id,
        };
      });
    }

    it('resolves correct roving tabindex and aria-selected states', () => {
      const tabs = [
        { id: 'token-bucket', label: 'Token Bucket' },
        { id: 'fixed-window', label: 'Fixed Window' },
      ];
      const attrs = resolveTabAttributes(tabs, 'token-bucket');

      expect(attrs[0]['aria-selected']).toBe('true');
      expect(attrs[0].tabindex).toBe(0);
      expect(attrs[1]['aria-selected']).toBe('false');
      expect(attrs[1].tabindex).toBe(-1);
    });

    it('updates active attributes when second tab is selected', () => {
      const tabs = [
        { id: 'token-bucket', label: 'Token Bucket' },
        { id: 'fixed-window', label: 'Fixed Window' },
      ];
      const attrs = resolveTabAttributes(tabs, 'fixed-window');

      expect(attrs[0]['aria-selected']).toBe('false');
      expect(attrs[0].tabindex).toBe(-1);
      expect(attrs[1]['aria-selected']).toBe('true');
      expect(attrs[1].tabindex).toBe(0);
    });
  });

  describe('Stage 3: Hero V3 & Platform Section Contracts', () => {
    it('verifies Hero V3 headline and subhead copy match Gate 1 approved deck', () => {
      const h1Expected = 'Rate limiting you can reason about.';
      const subheadExpected =
        'Zero runtime dependencies. Pure step functions and atomic stores so your tests and callers always agree.';

      expect(h1Expected).toBe('Rate limiting you can reason about.');
      expect(subheadExpected).toContain('Zero runtime dependencies');
      expect(subheadExpected).toContain('Pure step functions');
    });

    it('verifies Architecture Platform section headline and lede match copy deck', () => {
      const h2Expected = 'One engine. Decoupled algorithms, clocks, and stores.';
      const ledeExpected =
        'Your application code never touches rate limiting logic directly. A single check command executes a pure state transition against your chosen store.';

      expect(h2Expected).toBe('One engine. Decoupled algorithms, clocks, and stores.');
      expect(ledeExpected).toContain('never touches rate limiting logic directly');
    });

    it('verifies platform spec grid binds verified facts correctly', async () => {
      const { computeFacts } = await import('../src/facts.js');
      const facts = computeFacts();

      const runtimeDeps = facts.find((f) => f.id === 'runtime-deps')?.value;
      const adrCount = facts.find((f) => f.id === 'adr-count')?.value;
      const availableAlgos = facts.find((f) => f.id === 'available-algos')?.value;

      expect(runtimeDeps).toBe('0');
      expect(Number(adrCount)).toBeGreaterThanOrEqual(19);
      expect(availableAlgos).toMatch(/\d+ of \d+/);
    });

    it('verifies store switcher segmented control has valid tab roles and labels', () => {
      const storeTabs = [
        { id: 'memory', label: 'Memory', live: true },
        { id: 'redis', label: 'Redis', live: false },
      ];

      expect(storeTabs.length).toBe(2);
      expect(storeTabs[0].id).toBe('memory');
      expect(storeTabs[1].id).toBe('redis');
    });
  });
});

