import { describe, it, expect } from 'vitest';
import { lintCssContent } from '../scripts/lint-css-buttons.js';
import { lintSourceFile } from '../scripts/lint-source-buttons.js';
import { auditHtmlContent } from '../scripts/audit-html-buttons.js';
import { lintButtonLabel } from '../scripts/lint-button-labels.js';

describe('Button System Linter Suites', () => {
  describe('CSS Button Lint (lintCssContent)', () => {
    it('allows all selectors in buttons.css', () => {
      const violations = lintCssContent(
        'buttons.css',
        `button { appearance: none; } .rx-btn-primary { background: red; }`,
      );
      expect(violations).toHaveLength(0);
    });

    it('flags raw button element selectors in other css files', () => {
      const violations = lintCssContent(
        'landing.css',
        `button { margin: 0; }\nbutton:focus { outline: none; }`,
      );
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]?.message).toMatch(/Forbidden ad-hoc button styling/);
    });

    it('flags legacy .rx-btn-* classes in other css files', () => {
      const violations = lintCssContent(
        'landing.css',
        `.rx-btn--primary { background: blue; }\n.rx-btn-secondary { color: white; }`,
      );
      expect(violations.length).toBe(2);
    });

    it('flags [role="button"] selectors in other css files', () => {
      const violations = lintCssContent(
        'other.css',
        `[role="button"] { cursor: pointer; }`,
      );
      expect(violations.length).toBe(1);
    });

    it('ignores comments and non-button selectors', () => {
      const violations = lintCssContent(
        'clean.css',
        `/* button comment */\n.btn { color: white; }\n.card { background: black; }`,
      );
      expect(violations).toHaveLength(0);
    });
  });

  describe('Source Code Button Lint (lintSourceFile)', () => {
    it('allows native button usage in approved primitives', () => {
      const violations = lintSourceFile(
        'src/components/common/Button.astro',
        `<button type="button">Click</button>`,
      );
      expect(violations).toHaveLength(0);
    });

    it('flags raw <button> in page templates', () => {
      const violations = lintSourceFile(
        'src/pages/index.astro',
        `<div class="wrapper">\n  <button class="custom-btn">Click me</button>\n</div>`,
      );
      expect(violations.length).toBe(1);
      expect(violations[0]?.message).toMatch(/Raw <button> tag detected/);
    });

    it('allows <button role="tab"> for tablist controls', () => {
      const violations = lintSourceFile(
        'src/components/tabs.astro',
        `<button role="tab" aria-selected="true">Tab 1</button>`,
      );
      expect(violations).toHaveLength(0);
    });

    it('flags fake anchors with role="button"', () => {
      const violations = lintSourceFile(
        'src/components/hero.astro',
        `<a href="/action" role="button">Action</a>`,
      );
      expect(violations.length).toBe(1);
      expect(violations[0]?.message).toMatch(/Forbidden role="button" on <a>/);
    });

    it('flags fake anchors with href="#"', () => {
      const violations = lintSourceFile(
        'src/components/footer.astro',
        `<a href="#" onClick="doSomething()">Click</a>`,
      );
      expect(violations.length).toBe(1);
      expect(violations[0]?.message).toMatch(/Forbidden href="#" on anchor/);
    });
  });

  describe('Built HTML Button Audit (auditHtmlContent)', () => {
    it('passes compliant buttons and links', () => {
      const html = `
        <button type="button" class="btn" data-variant="primary">Send</button>
        <a href="/docs" class="btn" data-variant="secondary">Docs</a>
        <button type="button" class="btn" data-icon-only="true" aria-label="Search"><svg></svg></button>
      `;
      const violations = auditHtmlContent('dist/index.html', html);
      expect(violations).toHaveLength(0);
    });

    it('flags <a> missing href', () => {
      const html = `<a class="btn">Broken Link</a>`;
      const violations = auditHtmlContent('dist/index.html', html);
      expect(violations.some((v) => v.message.includes('without href'))).toBe(true);
    });

    it('flags <button> with href attribute', () => {
      const html = `<button href="/broken" class="btn">Invalid Button</button>`;
      const violations = auditHtmlContent('dist/index.html', html);
      expect(violations.some((v) => v.message.includes('invalid href attribute'))).toBe(true);
    });

    it('flags icon-only buttons missing aria-label', () => {
      const html = `<button type="button" class="btn" data-icon-only="true"><svg></svg></button>`;
      const violations = auditHtmlContent('dist/index.html', html);
      expect(violations.some((v) => v.message.includes('missing aria-label'))).toBe(true);
    });
  });

  describe('Button Label Lint (lintButtonLabel)', () => {
    it('accepts clean, sentence-case action labels', () => {
      expect(lintButtonLabel('Get started')).toHaveLength(0);
      expect(lintButtonLabel('Try the playground')).toHaveLength(0);
      expect(lintButtonLabel('Send burst')).toHaveLength(0);
      expect(lintButtonLabel('View MIT license')).toHaveLength(0);
      expect(lintButtonLabel('Read ADR documentation')).toHaveLength(0);
    });

    it('flags trailing punctuation', () => {
      const violations = lintButtonLabel('Get started!');
      expect(violations.some((v) => v.rule === 'no-trailing-punctuation')).toBe(true);
    });

    it('flags "Click here" labels', () => {
      const violations = lintButtonLabel('Click here to begin');
      expect(violations.some((v) => v.rule === 'no-click-here')).toBe(true);
    });

    it('flags unapproved ALL CAPS labels', () => {
      const violations = lintButtonLabel('SUBMIT NOW');
      expect(violations.some((v) => v.rule === 'no-all-caps')).toBe(true);
    });
  });
});
