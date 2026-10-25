import { describe, it, expect } from 'vitest';
import {
  isExternalUrl,
  resolveButtonContract,
  type BaseButtonProps,
} from '../src/components/common/button-builder.js';

describe('Button System Contract Builder', () => {
  describe('isExternalUrl', () => {
    it('returns false for local and relative paths', () => {
      expect(isExternalUrl('/getting-started/')).toBe(false);
      expect(isExternalUrl('./relative')).toBe(false);
      expect(isExternalUrl('../up')).toBe(false);
      expect(isExternalUrl('#features')).toBe(false);
      expect(isExternalUrl('')).toBe(false);
    });

    it('returns false for mailto and tel links', () => {
      expect(isExternalUrl('mailto:dev@example.com')).toBe(false);
      expect(isExternalUrl('tel:+1234567890')).toBe(false);
    });

    it('returns true for external https urls', () => {
      expect(isExternalUrl('https://github.com/zynorex/reqnx')).toBe(true);
      expect(isExternalUrl('https://twitter.com')).toBe(true);
      expect(isExternalUrl('http://insecure.org')).toBe(true);
    });
  });

  describe('resolveButtonContract', () => {
    it('resolves default button attributes', () => {
      const contract = resolveButtonContract({});
      expect(contract.tag).toBe('button');
      expect(contract.isAnchor).toBe(false);
      expect(contract.isExternal).toBe(false);
      expect(contract.attrs.class).toBe('btn');
      expect(contract.attrs['data-variant']).toBe('secondary');
      expect(contract.attrs['data-size']).toBe('md');
      expect(contract.attrs.type).toBe('button');
      expect(contract.attrs.disabled).toBeUndefined();
    });

    it('resolves variant, size, and custom classes', () => {
      const contract = resolveButtonContract({
        variant: 'primary',
        size: 'lg',
        className: 'custom-class',
      });
      expect(contract.attrs['data-variant']).toBe('primary');
      expect(contract.attrs['data-size']).toBe('lg');
      expect(contract.attrs.class).toBe('btn custom-class');
    });

    it('resolves internal anchor links with href', () => {
      const contract = resolveButtonContract({
        href: '/playground/',
        variant: 'primary',
      });
      expect(contract.tag).toBe('a');
      expect(contract.isAnchor).toBe(true);
      expect(contract.isExternal).toBe(false);
      expect(contract.attrs.href).toBe('/playground/');
      expect(contract.attrs.target).toBeUndefined();
      expect(contract.attrs.rel).toBeUndefined();
    });

    it('automatically adds target="_blank" and rel="noopener noreferrer" for external links', () => {
      const contract = resolveButtonContract({
        href: 'https://github.com/zynorex/reqnx',
      });
      expect(contract.tag).toBe('a');
      expect(contract.isAnchor).toBe(true);
      expect(contract.isExternal).toBe(true);
      expect(contract.attrs.href).toBe('https://github.com/zynorex/reqnx');
      expect(contract.attrs.target).toBe('_blank');
      expect(contract.attrs.rel).toBe('noopener noreferrer');
    });

    it('preserves explicit target and rel if provided', () => {
      const contract = resolveButtonContract({
        href: 'https://github.com/zynorex/reqnx',
        target: '_self',
        rel: 'external',
      });
      expect(contract.attrs.target).toBe('_self');
      expect(contract.attrs.rel).toBe('external');
    });

    it('converts disabled anchors to aria-disabled and strips href', () => {
      const contract = resolveButtonContract({
        href: '/docs',
        disabled: true,
      });
      expect(contract.tag).toBe('a');
      expect(contract.isAnchor).toBe(true);
      expect(contract.attrs['aria-disabled']).toBe('true');
      expect(contract.attrs.href).toBeUndefined();
    });

    it('sets disabled attribute on native buttons', () => {
      const contract = resolveButtonContract({
        disabled: true,
      });
      expect(contract.tag).toBe('button');
      expect(contract.attrs.disabled).toBe(true);
      expect(contract.attrs['aria-disabled']).toBeUndefined();
    });

    it('enforces accessible name for iconOnly buttons', () => {
      expect(() => {
        resolveButtonContract({ iconOnly: true });
      }).toThrow(/accessible name via ariaLabel/);

      const contract = resolveButtonContract({
        iconOnly: true,
        ariaLabel: 'Close dialog',
      });
      expect(contract.attrs['data-icon-only']).toBe('true');
      expect(contract.attrs['aria-label']).toBe('Close dialog');
    });

    it('sets loading and aria-busy attributes', () => {
      const contract = resolveButtonContract({
        loading: true,
      });
      expect(contract.attrs['data-loading']).toBe('true');
      expect(contract.attrs['aria-busy']).toBe('true');
    });

    it('sets block attribute when block=true', () => {
      const contract = resolveButtonContract({
        block: true,
      });
      expect(contract.attrs['data-block']).toBe('true');
    });

    it('propagates title, id, and ariaDescribedBy', () => {
      const contract = resolveButtonContract({
        id: 'submit-action',
        title: 'Submit form',
        ariaDescribedBy: 'error-note',
      });
      expect(contract.attrs.id).toBe('submit-action');
      expect(contract.attrs.title).toBe('Submit form');
      expect(contract.attrs['aria-describedby']).toBe('error-note');
    });

    it('sets data-shape="pill" when shape="pill"', () => {
      const contract = resolveButtonContract({
        shape: 'pill',
        size: 'lg',
      });
      expect(contract.attrs['data-shape']).toBe('pill');
      expect(contract.attrs['data-size']).toBe('lg');
    });
  });
});
