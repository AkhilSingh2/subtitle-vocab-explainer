import { lemmaCandidates } from '../shared/lemma';

export interface PhraseMatch {
  /** The dictionary key that matched, e.g. "break the ice". */
  phrase: string;
  meaning: string;
  /** Index into the sentence's word tokens. */
  startToken: number;
  /** Inclusive. Equal to `startToken` for a single-token match. */
  endToken: number;
}

/** Shared with the caption wrapper so token indices line up exactly. */
export const WORD_PATTERN = "[\\p{L}\\p{M}][\\p{L}\\p{M}'’-]*";

const MAX_NGRAM = 4;
const MIN_NGRAM = 2;

/** Lowercase, curly quote -> straight, strip leading/trailing apostrophes and hyphens. */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^['-]+|['-]+$/g, '');
}

export function extractWordTokens(sentence: string): string[] {
  const matches = sentence.match(new RegExp(WORD_PATTERN, 'gu')) ?? [];
  return matches.map(normalizeToken).filter((t) => t.length > 0);
}

function hasOwn(dictionary: Readonly<Record<string, string>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(dictionary, key);
}

/** Forms to try for the first token: as written, then its possible base forms. */
function firstTokenForms(token: string): string[] {
  return [token, ...lemmaCandidates(token)];
}

/**
 * Finds multi-word phrases (2–4 tokens, longest first, no overlaps) in a sentence, then single-token
 * matches. Only the first token of a phrase is lemmatised, so "broke the ice" and "giving up" match
 * "break the ice" and "give up".
 *
 * Multi-word matches come first in the result (in order), followed by single-token matches (in order).
 */
export function findPhrasesInSentence(
  sentence: string,
  dictionary: Readonly<Record<string, string>>,
): PhraseMatch[] {
  const tokens = extractWordTokens(sentence);
  const multi: PhraseMatch[] = [];
  const single: PhraseMatch[] = [];

  let i = 0;
  while (i < tokens.length) {
    let matched = false;

    for (let n = Math.min(MAX_NGRAM, tokens.length - i); n >= MIN_NGRAM && !matched; n--) {
      const rest = tokens.slice(i + 1, i + n).join(' ');
      for (const first of firstTokenForms(tokens[i] as string)) {
        const key = `${first} ${rest}`;
        if (hasOwn(dictionary, key)) {
          multi.push({
            phrase: key,
            meaning: dictionary[key] as string,
            startToken: i,
            endToken: i + n - 1,
          });
          i += n;
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    for (const form of firstTokenForms(tokens[i] as string)) {
      if (hasOwn(dictionary, form)) {
        single.push({ phrase: form, meaning: dictionary[form] as string, startToken: i, endToken: i });
        break;
      }
    }
    i++;
  }

  return [...multi, ...single];
}
