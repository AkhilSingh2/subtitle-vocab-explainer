import { describe, expect, it } from 'vitest';
import { IDIOMS } from '../src/shared/idioms';

const entries = Object.entries(IDIOMS);

describe('IDIOMS invariants', () => {
  it('has between 250 and 400 entries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(250);
    expect(entries.length).toBeLessThanOrEqual(400);
  });

  it('uses lowercase keys of 2–4 words', () => {
    for (const [key] of entries) {
      expect(key, key).toBe(key.toLowerCase());
      const words = key.split(' ');
      expect(words.length, key).toBeGreaterThanOrEqual(2);
      expect(words.length, key).toBeLessThanOrEqual(4);
      expect(key, key).toBe(key.trim());
      expect(key, key).not.toMatch(/\s{2,}/);
    }
  });

  it('uses straight apostrophes only', () => {
    for (const [key] of entries) expect(key, key).not.toContain('’');
  });

  it('has a non-empty meaning of at most 15 words', () => {
    for (const [key, meaning] of entries) {
      const words = meaning.trim().split(/\s+/);
      expect(words.length, key).toBeGreaterThan(0);
      expect(words.length, `${key} -> ${meaning}`).toBeLessThanOrEqual(15);
    }
  });
});
