import { describe, expect, it } from 'vitest';
import { describeStatus } from '../src/popup/status';
import { csvFileName, timeAgo } from '../src/popup/time';
import { filterWords } from '../src/popup/components/WordsTab';
import { keyErrorCopy } from '../src/popup/components/SettingsTab';
import type { ContentState, SavedWord } from '../src/shared/types';

const state = (patch: Partial<ContentState> = {}): ContentState => ({
  site: 'youtube',
  isWatchPage: true,
  captionsStatus: 'detected',
  enabled: true,
  ...patch,
});

describe('describeStatus (docs/03 §7.1)', () => {
  it('covers every row of the table', () => {
    expect(describeStatus(null, true)).toEqual({ tone: 'grey', text: 'Open a YouTube or Netflix video' });
    expect(describeStatus(state({ isWatchPage: false }), true)).toEqual({ tone: 'grey', text: 'Open a video to start' });
    expect(describeStatus(state({ captionsStatus: 'waiting' }), true)).toEqual({
      tone: 'amber',
      text: 'Turn on captions/subtitles to start',
    });
    expect(describeStatus(state(), true)).toEqual({ tone: 'green', text: 'Active on YouTube — captions detected' });
    expect(describeStatus(state({ site: 'netflix' }), true).text).toBe('Active on Netflix — captions detected');
    expect(describeStatus(state({ captionsStatus: 'not-detected' }), true)).toEqual({
      tone: 'red',
      text: 'Captions not detected — the site may have changed',
    });
    expect(describeStatus(state(), false)).toEqual({ tone: 'grey', text: 'Paused — turn on to use' });
  });

  it('says "paused" even when no content script answers', () => {
    expect(describeStatus(null, false).text).toBe('Paused — turn on to use');
  });
});

describe('timeAgo', () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0);
  it('formats relative times', () => {
    expect(timeAgo(now - 10_000, now)).toBe('just now');
    expect(timeAgo(now - 2 * 60_000, now)).toBe('2m ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(timeAgo(now - 5 * 86_400_000, now)).toBe('5d ago');
  });
  it('falls back to a date for old entries and never goes negative', () => {
    expect(timeAgo(now - 90 * 86_400_000, now)).toMatch(/\d{4}/);
    expect(timeAgo(now + 5000, now)).toBe('just now');
  });
});

describe('csvFileName', () => {
  it('uses the local date', () => {
    expect(csvFileName(new Date(2026, 0, 5))).toBe('vocab-2026-01-05.csv');
    expect(csvFileName(new Date(2026, 10, 25))).toBe('vocab-2026-11-25.csv');
  });
});

describe('filterWords', () => {
  const word = (term: string, definition: string, context: string): SavedWord => ({
    id: term,
    term,
    definition,
    context,
    level: 'B2',
    estimated: true,
    partOfSpeech: 'noun',
    site: 'youtube',
    pageTitle: 't',
    url: 'https://www.youtube.com/watch?v=1',
    savedAt: 1,
  });
  const words = [
    word('reluctant', 'Not wanting to do something.', 'He was reluctant to go.'),
    word('break the ice', 'Relax people.', 'A joke to break the ice.'),
  ];
  it('matches term, definition and context, case-insensitively', () => {
    expect(filterWords(words, 'RELUC').map((w) => w.term)).toEqual(['reluctant']);
    expect(filterWords(words, 'relax').map((w) => w.term)).toEqual(['break the ice']);
    expect(filterWords(words, 'a joke').map((w) => w.term)).toEqual(['break the ice']);
  });
  it('returns everything for an empty query and nothing for no match', () => {
    expect(filterWords(words, '  ')).toHaveLength(2);
    expect(filterWords(words, 'zzz')).toEqual([]);
  });
});

describe('keyErrorCopy', () => {
  it('maps error codes to readable copy', () => {
    expect(keyErrorCopy({ code: 'INVALID_KEY', message: '' })).toContain('rejected');
    expect(keyErrorCopy({ code: 'RATE_LIMIT', message: '' })).toContain('Too many requests');
    expect(keyErrorCopy({ code: 'NETWORK', message: '' })).toContain('Couldn’t reach');
    expect(keyErrorCopy({ code: 'NO_KEY', message: '' })).toBe('Enter a key first.');
    expect(keyErrorCopy({ code: 'UNKNOWN', message: '' })).toBe('Couldn’t verify the key.');
  });
});
