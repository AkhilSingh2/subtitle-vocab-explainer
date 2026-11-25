import { describe, expect, it } from 'vitest';
import { extractWordTokens, findPhrasesInSentence } from '../src/content/idiomMatcher';
import { IDIOMS } from '../src/shared/idioms';

const dict = {
  'break the ice': 'make people relax',
  'give up': 'quit',
  'look forward to': 'be happy about the future',
  'piece of cake': 'easy',
  'a piece of cake': 'very easy',
  "don't mention it": 'you are welcome',
  'run out of': 'have none left',
};

describe('extractWordTokens', () => {
  it('lowercases, normalises curly quotes and strips edge punctuation', () => {
    expect(extractWordTokens("Don’t STOP, -well-known- 'quoted'")).toEqual([
      "don't",
      'stop',
      'well-known',
      'quoted',
    ]);
  });

  it('returns an empty array for empty or symbol-only input', () => {
    expect(extractWordTokens('')).toEqual([]);
    expect(extractWordTokens('... !!! 123')).toEqual([]);
  });
});

describe('findPhrasesInSentence', () => {
  it('finds a multi-word phrase with token indices', () => {
    expect(findPhrasesInSentence('He wanted to break the ice quickly', dict)).toEqual([
      { phrase: 'break the ice', meaning: 'make people relax', startToken: 3, endToken: 5 },
    ]);
  });

  it('matches an inflected first token ("broke the ice")', () => {
    const [match] = findPhrasesInSentence('She broke the ice with a joke.', dict);
    expect(match?.phrase).toBe('break the ice');
    expect([match?.startToken, match?.endToken]).toEqual([1, 3]);
  });

  it('matches -ing forms that need an "e" restored ("giving up")', () => {
    const [match] = findPhrasesInSentence("I'm not giving up", dict);
    expect(match?.phrase).toBe('give up');
  });

  it('prefers the longest match', () => {
    const [match] = findPhrasesInSentence('It was a piece of cake', dict);
    expect(match?.phrase).toBe('a piece of cake');
    expect([match?.startToken, match?.endToken]).toEqual([2, 5]);
  });

  it('is case-insensitive and ignores punctuation between words', () => {
    const matches = findPhrasesInSentence('BREAK, the ICE!', dict);
    expect(matches.map((m) => m.phrase)).toEqual(['break the ice']);
  });

  it('handles apostrophes, including curly ones', () => {
    expect(findPhrasesInSentence("Oh, don't mention it", dict)[0]?.phrase).toBe("don't mention it");
    expect(findPhrasesInSentence('Oh, don’t mention it', dict)[0]?.phrase).toBe("don't mention it");
  });

  it('finds adjacent phrases without overlap', () => {
    const matches = findPhrasesInSentence('give up and break the ice', dict);
    expect(matches.map((m) => [m.phrase, m.startToken, m.endToken])).toEqual([
      ['give up', 0, 1],
      ['break the ice', 3, 5],
    ]);
  });

  it('does not report overlapping matches', () => {
    const overlapping = { 'a b': 'x', 'b c': 'y' };
    const matches = findPhrasesInSentence('a b c', overlapping);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.phrase).toBe('a b');
  });

  it('returns nothing when there is no match or the input is empty', () => {
    expect(findPhrasesInSentence('Nothing to see here', dict)).toEqual([]);
    expect(findPhrasesInSentence('', dict)).toEqual([]);
    expect(findPhrasesInSentence('give', dict)).toEqual([]);
  });

  it('returns single-token matches after multi-word matches', () => {
    const custom = { ...dict, serendipity: 'a happy accident' };
    const matches = findPhrasesInSentence('serendipity helped him give up', custom);
    expect(matches.map((m) => m.phrase)).toEqual(['give up', 'serendipity']);
    expect(matches[1]).toMatchObject({ startToken: 0, endToken: 0 });
  });

  it('does not match inherited object properties like "constructor"', () => {
    expect(findPhrasesInSentence('constructor toString', {})).toEqual([]);
  });

  it('works with the bundled idiom list', () => {
    const phrases = findPhrasesInSentence(
      'We ran out of time, so he gave up and called it a day.',
      IDIOMS,
    ).map((m) => m.phrase);
    expect(phrases).toContain('run out of');
    expect(phrases).toContain('give up');
    expect(phrases).toContain('call it a day');
  });
});
