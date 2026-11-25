import { lemmatize } from '../shared/lemma';
import { WORD_PATTERN, normalizeToken, type PhraseMatch } from './idiomMatcher';

export interface WordToken {
  type: 'word';
  text: string;
  wordIndex: number;
}
export interface TextToken {
  type: 'text';
  text: string;
}
export type Token = WordToken | TextToken;

/** Splits text into word and non-word tokens; concatenating all token texts gives back the input. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = new RegExp(WORD_PATTERN, 'gu');
  let last = 0;
  let wordIndex = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ type: 'text', text: text.slice(last, start) });
    const raw = match[0];
    // A match that normalises to nothing (e.g. only hyphens) cannot happen with WORD_PATTERN,
    // but keep indices consistent with extractWordTokens by skipping it as plain text.
    if (normalizeToken(raw) === '') {
      tokens.push({ type: 'text', text: raw });
    } else {
      tokens.push({ type: 'word', text: raw, wordIndex: wordIndex++ });
    }
    last = start + raw.length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

export function countWords(text: string): number {
  return tokenize(text).filter((t) => t.type === 'word').length;
}

/** Key used to compare a caption word with the saved-word set. */
export function savedKey(word: string): string {
  const lower = normalizeToken(word);
  return lemmatize(lower) || lower;
}

function isSaved(word: string, saved: ReadonlySet<string>): boolean {
  return saved.has(normalizeToken(word)) || saved.has(savedKey(word));
}

export interface WrapOptions {
  /** Phrase matches with token indices relative to *this line's* word tokens. */
  phrases: readonly PhraseMatch[];
  saved: ReadonlySet<string>;
}

const processedText = new WeakMap<Element, string>();

/** True if the line is already wrapped and its text has not changed since. */
export function isLineProcessed(line: Element): boolean {
  return (
    processedText.get(line) === line.textContent &&
    line.querySelector(':scope > .sve-w, :scope > .sve-p') !== null
  );
}

/**
 * Rebuilds a caption line as `<span class="sve-w">` word spans (grouped into `<span class="sve-p">` for
 * idioms). All text is inserted with text nodes — never innerHTML — because captions are untrusted.
 * Returns false if the line was already processed or is empty.
 */
export function wrapLine(line: HTMLElement, options: WrapOptions): boolean {
  if (isLineProcessed(line)) return false;
  const text = line.textContent ?? '';
  if (text.trim() === '') return false;

  const doc = line.ownerDocument;
  const tokens = tokenize(text);
  const byStart = new Map<number, PhraseMatch>();
  for (const phrase of options.phrases) {
    if (phrase.endToken > phrase.startToken) byStart.set(phrase.startToken, phrase);
  }

  const makeWord = (token: WordToken): HTMLElement => {
    const span = doc.createElement('span');
    span.className = isSaved(token.text, options.saved) ? 'sve-w sve-saved' : 'sve-w';
    span.dataset['sveI'] = String(token.wordIndex);
    span.textContent = token.text;
    return span;
  };

  const fragment = doc.createDocumentFragment();
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] as Token;
    if (token.type === 'text') {
      fragment.append(doc.createTextNode(token.text));
      i++;
      continue;
    }

    const phrase = byStart.get(token.wordIndex);
    if (!phrase) {
      fragment.append(makeWord(token));
      i++;
      continue;
    }

    const group = doc.createElement('span');
    group.className = 'sve-p';
    group.dataset['svePhrase'] = phrase.phrase;
    while (i < tokens.length) {
      const inner = tokens[i] as Token;
      i++;
      if (inner.type === 'text') {
        group.append(doc.createTextNode(inner.text));
        continue;
      }
      group.append(makeWord(inner));
      if (inner.wordIndex === phrase.endToken) break;
    }
    fragment.append(group);
  }

  line.replaceChildren(fragment);
  line.dataset['sveDone'] = '1';
  processedText.set(line, line.textContent ?? '');
  return true;
}

/** Re-applies the saved-word underline to already wrapped words. */
export function applySavedClasses(root: ParentNode, saved: ReadonlySet<string>): void {
  for (const el of root.querySelectorAll<HTMLElement>('.sve-w')) {
    el.classList.toggle('sve-saved', isSaved(el.textContent ?? '', saved));
  }
}
