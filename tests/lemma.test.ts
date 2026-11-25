import { describe, expect, it } from 'vitest';
import { lemmatize } from '../src/shared/lemma';

describe('lemmatize (no vocabulary)', () => {
  it('maps irregular verbs', () => {
    expect(lemmatize('broke')).toBe('break');
    expect(lemmatize('broken')).toBe('break');
    expect(lemmatize('went')).toBe('go');
    expect(lemmatize('Gone')).toBe('go');
    expect(lemmatize('took')).toBe('take');
  });

  it('applies suffix rules', () => {
    expect(lemmatize('studies')).toBe('study');
    expect(lemmatize('studied')).toBe('study');
    expect(lemmatize('walks')).toBe('walk');
    expect(lemmatize('stopped')).toBe('stop');
    expect(lemmatize('running')).toBe('run');
    expect(lemmatize('giving')).toBe('giv');
  });

  it('strips possessives and curly apostrophes', () => {
    expect(lemmatize('dog’s')).toBe('dog');
    expect(lemmatize("dog's")).toBe('dog');
  });

  it('leaves words without a suffix alone', () => {
    expect(lemmatize('ice')).toBe('ice');
    expect(lemmatize('glass')).toBe('glass');
  });

  it('handles empty and punctuation-only input', () => {
    expect(lemmatize('')).toBe('');
    expect(lemmatize('--')).toBe('');
  });
});

describe('lemmatize (with vocabulary)', () => {
  const vocab = new Set(['give', 'make', 'ice', 'walk']);
  const exists = (w: string): boolean => vocab.has(w);

  it('picks the first candidate that is a known word', () => {
    expect(lemmatize('giving', exists)).toBe('give');
    expect(lemmatize('making', exists)).toBe('make');
    expect(lemmatize('walked', exists)).toBe('walk');
  });

  it('returns the word itself when it is already known', () => {
    expect(lemmatize('ice', exists)).toBe('ice');
  });

  it('falls back to the original word when nothing matches', () => {
    expect(lemmatize('zzzing', exists)).toBe('zzzing');
  });
});
