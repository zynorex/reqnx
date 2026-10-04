import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { ConfigError } from '../errors.js';
import { parseDuration } from '../duration.js';
import { type Duration } from '../types.js';

describe('parseDuration', () => {
  describe('table tests — valid durations', () => {
    const validCases: Array<[Duration, number]> = [
      [5000, 5000],
      [1, 1],
      ['500ms', 500],
      ['30s', 30_000],
      ['2m', 120_000],
      ['1h', 3_600_000],
      ['1d', 86_400_000],
      ['366d', 31_622_400_000],
      ['0.5s', 500],
      ['1.5s', 1500],
      ['0.001s', 1],
    ];

    for (const [input, expected] of validCases) {
      it(`parses ${JSON.stringify(input)} to ${expected} ms`, () => {
        expect(parseDuration(input)).toBe(expected);
      });
    }
  });

  describe('table tests — invalid durations', () => {
    const invalidCases: Array<[unknown, string]> = [
      [0, 'zero number'],
      [-1, 'negative number'],
      [-100, 'large negative number'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
      ['0s', 'zero with unit'],
      ['0ms', 'zero ms'],
      ['-1s', 'negative with unit'],
      ['-500ms', 'negative ms'],
      [' 30s', 'leading whitespace'],
      ['30 s', 'internal whitespace'],
      ['30s ', 'trailing whitespace'],
      ['30x', 'invalid unit'],
      ['', 'empty string'],
      ['367d', 'exceeds 366-day cap'],
      ['1.5001s', 'fractional ms result (1500.1ms)'],
      ['1.23456ms', 'fractional ms'],
      ['abc', 'non-numeric string'],
      [null as unknown as Duration, 'null'],
      [undefined as unknown as Duration, 'undefined'],
      [true as unknown as Duration, 'boolean'],
      [{} as unknown as Duration, 'object'],
    ];

    for (const [input, label] of invalidCases) {
      it(`rejects ${label} (${JSON.stringify(input)}) with ConfigError`, () => {
        expect(() => parseDuration(input as Duration)).toThrow(ConfigError);
      });
    }
  });

  describe('property-based tests (fast-check)', () => {
    it('round-trips arbitrary positive integers up to 366 days', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 31_622_400_000 }), (n) => {
          expect(parseDuration(n)).toBe(n);
        }),
      );
    });

    it('correctly parses valid integer units', () => {
      const units: Array<[string, number, number]> = [
        ['ms', 1, 31_622_400_000],
        ['s', 1000, 31_622_400],
        ['m', 60_000, 527_040],
        ['h', 3_600_000, 8784],
        ['d', 86_400_000, 366],
      ];

      for (const [unit, multiplier, maxVal] of units) {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: maxVal }), (n) => {
            const str = `${n}${unit}`;
            expect(parseDuration(str as Duration)).toBe(n * multiplier);
          }),
        );
      }
    });

    it('rejects arbitrary strings not conforming to the format', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^\d+(?:\.\d+)?(ms|s|m|h|d)$/.test(s)),
          (garbage) => {
            expect(() => parseDuration(garbage as Duration)).toThrow(ConfigError);
          },
        ),
      );
    });
  });
});
