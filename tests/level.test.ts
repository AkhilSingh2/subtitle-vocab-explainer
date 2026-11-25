import { describe, expect, it } from 'vitest';
import { estimateLevel, levelFromRank } from '../src/shared/level';
import { wordFrequency } from '../src/shared/wordFrequency';

describe('levelFromRank', () => {
  it('maps rank thresholds to levels', () => {
    expect(levelFromRank(1)).toBe('A2');
    expect(levelFromRank(1500)).toBe('A2');
    expect(levelFromRank(1501)).toBe('B1');
    expect(levelFromRank(3000)).toBe('B1');
    expect(levelFromRank(3001)).toBe('B2');
    expect(levelFromRank(5000)).toBe('B2');
    expect(levelFromRank(5001)).toBe('C1');
    expect(levelFromRank(9000)).toBe('C1');
    expect(levelFromRank(9001)).toBe('C2');
  });

  it('treats unknown words as C2', () => {
    expect(levelFromRank(undefined)).toBe('C2');
  });
});

describe('estimateLevel', () => {
  it('has a loaded frequency list of about 20k words', () => {
    expect(Object.keys(wordFrequency).length).toBeGreaterThan(19000);
    expect(wordFrequency['the']).toBe(1);
  });

  it('is always an estimate', () => {
    expect(estimateLevel('house', false).estimated).toBe(true);
    expect(estimateLevel('break the ice', true).estimated).toBe(true);
  });

  it('gives common words an easy level', () => {
    expect(estimateLevel('the', false).level).toBe('A2');
    expect(estimateLevel('house', false).level).toBe('A2');
  });

  it('gives unknown words C2', () => {
    expect(estimateLevel('floccinaucinihilipilification', false).level).toBe('C2');
  });

  it('lemmatizes before looking up (inflected forms)', () => {
    expect(estimateLevel('houses', false).level).toBe(estimateLevel('house', false).level);
  });

  it('reports idioms as B2', () => {
    expect(estimateLevel('break the ice', true)).toEqual({ level: 'B2', estimated: true });
  });
});
