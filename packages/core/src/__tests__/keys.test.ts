import { describe, expect, it } from 'vitest';
import { buildKey, MAX_KEY_BYTES, validateIdentity, validateKey, validatePrefix } from '../keys.js';
import { InputError } from '../errors.js';

describe('Key utilities', () => {
  describe('buildKey', () => {
    it('builds standard key with valid prefix, algorithmId, and identity', () => {
      const key = buildKey('api', 'fixed-window', '192.168.1.1');
      expect(key).toBe('reqnx:api:fixed-window:192.168.1.1');
    });

    it('rejects empty prefix with InputError', () => {
      expect(() => buildKey('', 'fixed-window', 'user1')).toThrow(InputError);
    });

    it('rejects prefix with colon with InputError', () => {
      expect(() => buildKey('api:v1', 'fixed-window', 'user1')).toThrow(InputError);
    });

    it('rejects prefix with control characters or whitespace with InputError', () => {
      expect(() => buildKey('api v1', 'fixed-window', 'user1')).toThrow(InputError);
      expect(() => buildKey('api\tv1', 'fixed-window', 'user1')).toThrow(InputError);
      expect(() => buildKey('api\nv1', 'fixed-window', 'user1')).toThrow(InputError);
    });

    it('rejects empty identity with InputError', () => {
      expect(() => buildKey('api', 'fixed-window', '')).toThrow(InputError);
    });

    it('rejects identity with control characters with InputError', () => {
      expect(() => buildKey('api', 'fixed-window', 'user\x001')).toThrow(InputError);
      expect(() => buildKey('api', 'fixed-window', 'user\n1')).toThrow(InputError);
      expect(() => buildKey('api', 'fixed-window', 'user\t1')).toThrow(InputError);
      expect(() => buildKey('api', 'fixed-window', 'user\x1f1')).toThrow(InputError);
      expect(() => buildKey('api', 'fixed-window', 'user\x7f1')).toThrow(InputError);
    });

    it('allows identity with spaces or unicode characters', () => {
      const key = buildKey('api', 'fixed-window', 'user test 🚀');
      expect(key).toBe('reqnx:api:fixed-window:user test 🚀');
    });

    it('allows key at exactly MAX_KEY_BYTES', () => {
      // reqnx:api:fixed-window: is 23 ASCII bytes
      const baseLen = new TextEncoder().encode('reqnx:api:fixed-window:').byteLength;
      const idLen = MAX_KEY_BYTES - baseLen;
      const identity = 'a'.repeat(idLen);

      const key = buildKey('api', 'fixed-window', identity);
      expect(new TextEncoder().encode(key).byteLength).toBe(MAX_KEY_BYTES);
    });

    it('rejects key exceeding MAX_KEY_BYTES with InputError', () => {
      const baseLen = new TextEncoder().encode('reqnx:api:fixed-window:').byteLength;
      const idLen = MAX_KEY_BYTES - baseLen + 1;
      const identity = 'a'.repeat(idLen);

      expect(() => buildKey('api', 'fixed-window', identity)).toThrow(InputError);
    });

    it('respects custom maxKeyBytes option', () => {
      expect(() => buildKey('api', 'fixed-window', 'a'.repeat(50), { maxKeyBytes: 40 })).toThrow(
        InputError,
      );

      const key = buildKey('api', 'fixed-window', 'a'.repeat(10), {
        maxKeyBytes: 40,
      });
      expect(key).toBeDefined();
    });
  });

  describe('validateKey', () => {
    it('returns true for valid keys', () => {
      expect(validateKey('user-123')).toBe(true);
      expect(validateKey('192.168.1.1')).toBe(true);
      expect(validateKey('valid key with spaces')).toBe(true);
    });

    it('returns false for empty or non-string inputs', () => {
      expect(validateKey('')).toBe(false);
      expect(validateKey(null as unknown as string)).toBe(false);
      expect(validateKey(undefined as unknown as string)).toBe(false);
      expect(validateKey(123 as unknown as string)).toBe(false);
    });

    it('returns false for keys with control characters', () => {
      expect(validateKey('user\x00')).toBe(false);
      expect(validateKey('user\n')).toBe(false);
      expect(validateKey('user\r')).toBe(false);
      expect(validateKey('user\t')).toBe(false);
    });

    it('returns false for oversized keys', () => {
      const huge = 'x'.repeat(1000);
      expect(validateKey(huge)).toBe(false);
    });
  });

  describe('validatePrefix & validateIdentity helpers', () => {
    it('validatePrefix throws on invalid prefix', () => {
      expect(() => validatePrefix('')).toThrow(InputError);
      expect(() => validatePrefix('a:b')).toThrow(InputError);
      expect(() => validatePrefix('a b')).toThrow(InputError);
    });

    it('validateIdentity throws on invalid identity', () => {
      expect(() => validateIdentity('')).toThrow(InputError);
      expect(() => validateIdentity('test\x00')).toThrow(InputError);
    });
  });
});
