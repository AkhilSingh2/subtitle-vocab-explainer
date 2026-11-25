import { describe, expect, it } from 'vitest';
import { savedWordsToCsv } from '../src/shared/csv';
import type { SavedWord } from '../src/shared/types';

function word(overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    id: 'break the ice|abcd1234',
    term: 'break the ice',
    definition: 'To make people feel relaxed.',
    context: 'He told a joke to break the ice.',
    level: 'C1',
    estimated: false,
    partOfSpeech: 'idiom',
    site: 'youtube',
    pageTitle: 'My Talk',
    url: 'https://www.youtube.com/watch?v=abc',
    savedAt: Date.UTC(2026, 9, 10, 12, 0, 0),
    ...overrides,
  };
}

describe('savedWordsToCsv', () => {
  it('writes the header and one row per word, joined by CRLF', () => {
    const csv = savedWordsToCsv([word(), word({ term: 'reluctant', id: 'r|1' })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('word,definition,context,level,source,url,savedAt');
  });

  it('quotes every field and doubles inner quotes', () => {
    const csv = savedWordsToCsv([word({ definition: 'He said "hi", then left' })]);
    expect(csv).toContain('"He said ""hi"", then left"');
  });

  it('keeps commas and newlines inside quoted fields', () => {
    const csv = savedWordsToCsv([word({ context: 'line one,\nline two' })]);
    expect(csv).toContain('"line one,\nline two"');
  });

  it('formats source, estimated level and ISO date', () => {
    const csv = savedWordsToCsv([word({ site: 'netflix', estimated: true, level: 'B2' })]);
    expect(csv).toContain('"Netflix · My Talk"');
    expect(csv).toContain('"est. B2"');
    expect(csv).toContain('"2026-10-10T12:00:00.000Z"');
  });

  it('does not add a BOM itself (the caller does)', () => {
    expect(savedWordsToCsv([]).charCodeAt(0)).not.toBe(0xfeff);
  });

  it('returns only the header for an empty list', () => {
    expect(savedWordsToCsv([])).toBe('word,definition,context,level,source,url,savedAt');
  });
});
