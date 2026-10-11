import { describe, it, expect } from 'vitest';
import { copyDeck } from '../src/copy/landing.copy';

const BANNED_WORDS = [
  'blazing',
  'seamless',
  'powerful',
  'effortless',
  'robust',
  'revolutionary',
  'next-generation',
  'supercharge',
  'unlock',
  'leverage',
  'world-class',
  'production-ready',
  'battle-tested',
  'enterprise-grade',
];

function extractStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(extractStrings);
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).flatMap(extractStrings);
  }
  return [];
}

describe('Copy Deck Quality & Honesty Lint', () => {
  const allStrings = extractStrings(copyDeck);

  it('contains no banned marketing buzzwords', () => {
    for (const str of allStrings) {
      const lower = str.toLowerCase();
      for (const banned of BANNED_WORDS) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  it('contains zero exclamation marks', () => {
    for (const str of allStrings) {
      expect(str).not.toContain('!');
    }
  });

  it('contains zero emojis in text copy', () => {
    // Emoji regex checking common emoji unicode planes
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u;
    for (const str of allStrings) {
      expect(str).not.toMatch(emojiRegex);
    }
  });

  it('has at least five headline options with exactly one primary recommended', () => {
    expect(copyDeck.hero.headlineOptions.length).toBeGreaterThanOrEqual(5);
    const primaryOptions = copyDeck.hero.headlineOptions.filter((h) => h.isPrimary);
    expect(primaryOptions).toHaveLength(1);
    expect(primaryOptions[0]?.headline).toBe('Rate limiting built from small, checkable parts.');
  });
});
