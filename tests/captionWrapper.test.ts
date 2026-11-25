import { beforeEach, describe, expect, it } from 'vitest';
import {
  applySavedClasses,
  countWords,
  isLineProcessed,
  tokenize,
  wrapLine,
} from '../src/content/captionWrapper';
import { findPhrasesInSentence } from '../src/content/idiomMatcher';

const none: ReadonlySet<string> = new Set();

function line(text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'ytp-caption-segment';
  el.textContent = text;
  document.body.append(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('tokenize', () => {
  it('round-trips the original text', () => {
    const text = "Hello, world! It's a well-known café — 42 times.";
    expect(
      tokenize(text)
        .map((t) => t.text)
        .join(''),
    ).toBe(text);
  });

  it('numbers only the word tokens', () => {
    const words = tokenize('Hi, you there?').filter((t) => t.type === 'word');
    expect(words.map((t) => (t.type === 'word' ? t.wordIndex : -1))).toEqual([0, 1, 2]);
  });

  it('counts words consistently', () => {
    expect(countWords('')).toBe(0);
    expect(countWords("don't stop — now")).toBe(3);
  });
});

describe('wrapLine', () => {
  it('wraps every word in a .sve-w span and preserves the text exactly', () => {
    const el = line('Hello, brave new world!');
    expect(wrapLine(el, { phrases: [], saved: none })).toBe(true);
    expect(el.textContent).toBe('Hello, brave new world!');
    const words = Array.from(el.querySelectorAll('.sve-w')).map((w) => w.textContent);
    expect(words).toEqual(['Hello', 'brave', 'new', 'world']);
    expect(el.querySelector('.sve-w')?.getAttribute('data-sve-i')).toBe('0');
    expect(el.dataset['sveDone']).toBe('1');
  });

  it('is idempotent', () => {
    const el = line('Hello there');
    expect(wrapLine(el, { phrases: [], saved: none })).toBe(true);
    const html = el.innerHTML;
    expect(isLineProcessed(el)).toBe(true);
    expect(wrapLine(el, { phrases: [], saved: none })).toBe(false);
    expect(el.innerHTML).toBe(html);
  });

  it('re-wraps when the site replaces the text', () => {
    const el = line('First line');
    wrapLine(el, { phrases: [], saved: none });
    el.textContent = 'Second line';
    expect(isLineProcessed(el)).toBe(false);
    expect(wrapLine(el, { phrases: [], saved: none })).toBe(true);
    expect(Array.from(el.querySelectorAll('.sve-w')).map((w) => w.textContent)).toEqual([
      'Second',
      'line',
    ]);
  });

  it('skips empty lines', () => {
    const el = line('   ');
    expect(wrapLine(el, { phrases: [], saved: none })).toBe(false);
  });

  it('groups idioms into a .sve-p span containing the word spans', () => {
    const el = line('He had to break the ice.');
    const phrases = findPhrasesInSentence(el.textContent ?? '', { 'break the ice': 'relax' });
    wrapLine(el, { phrases, saved: none });
    const group = el.querySelector('.sve-p');
    expect(group?.getAttribute('data-sve-phrase')).toBe('break the ice');
    expect(group?.textContent).toBe('break the ice');
    expect(group?.querySelectorAll('.sve-w')).toHaveLength(3);
    expect(el.textContent).toBe('He had to break the ice.');
    // words outside the phrase are not inside the group
    expect(el.querySelectorAll(':scope > .sve-w')).toHaveLength(3);
  });

  it('ignores single-token matches when grouping', () => {
    const el = line('serendipity happens');
    wrapLine(el, {
      phrases: [{ phrase: 'serendipity', meaning: 'x', startToken: 0, endToken: 0 }],
      saved: none,
    });
    expect(el.querySelector('.sve-p')).toBeNull();
  });

  it('marks saved words, including inflected forms', () => {
    const el = line('He walks and Walked home');
    wrapLine(el, { phrases: [], saved: new Set(['walk']) });
    const saved = Array.from(el.querySelectorAll('.sve-saved')).map((w) => w.textContent);
    expect(saved).toEqual(['walks', 'Walked']);
  });

  it('treats caption text as text, never as HTML', () => {
    const el = line('<img src=x onerror="window.__pwned=1"> hello');
    wrapLine(el, { phrases: [], saved: none });
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror="window.__pwned=1"> hello');
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
});

describe('applySavedClasses', () => {
  it('toggles the saved class on existing words', () => {
    const el = line('talk and listen');
    wrapLine(el, { phrases: [], saved: none });
    expect(el.querySelectorAll('.sve-saved')).toHaveLength(0);
    applySavedClasses(document, new Set(['listen']));
    expect(Array.from(el.querySelectorAll('.sve-saved')).map((w) => w.textContent)).toEqual([
      'listen',
    ]);
    applySavedClasses(document, none);
    expect(el.querySelectorAll('.sve-saved')).toHaveLength(0);
  });
});
