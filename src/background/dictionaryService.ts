import { lemmaCandidates } from '../shared/lemma';
import type { AppError, DictMeaning, DictResult } from '../shared/types';
import { NEGATIVE_TTL_MS, DEFAULT_TTL_MS, getOrFetch } from './cache';

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MAX_DEFINITIONS_PER_MEANING = 3;
const MAX_LEMMA_RETRIES = 2;

interface RawPhonetic {
  text?: string;
  audio?: string;
}
interface RawEntry {
  word?: string;
  phonetic?: string;
  phonetics?: RawPhonetic[];
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
  }>;
}

function networkError(message: string): AppError {
  return { code: 'NETWORK', message };
}

function normalizeAudio(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('//')) return `https:${url}`;
  return url.startsWith('https://') ? url : undefined;
}

/** Turns the dictionaryapi.dev response into our DictResult. Returns null if nothing usable. */
export function normalizeEntries(entries: unknown): DictResult | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const list = entries as RawEntry[];
  const first = list[0];
  if (!first) return null;

  const phonetic =
    first.phonetic ?? list.flatMap((e) => e.phonetics ?? []).find((p) => p.text)?.text;
  const audioUrl = normalizeAudio(
    list.flatMap((e) => e.phonetics ?? []).find((p) => normalizeAudio(p.audio))?.audio,
  );

  const meanings: DictMeaning[] = [];
  for (const entry of list) {
    for (const meaning of entry.meanings ?? []) {
      const definitions = (meaning.definitions ?? [])
        .filter((d): d is { definition: string; example?: string } => typeof d.definition === 'string')
        .slice(0, MAX_DEFINITIONS_PER_MEANING)
        .map((d) => (d.example ? { definition: d.definition, example: d.example } : { definition: d.definition }));
      if (definitions.length > 0) {
        meanings.push({ partOfSpeech: meaning.partOfSpeech ?? '', definitions });
      }
    }
  }
  if (meanings.length === 0) return null;

  return {
    word: first.word ?? '',
    ...(phonetic ? { phonetic } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    meanings,
  };
}

async function fetchEntry(word: string): Promise<DictResult | null> {
  let response: Response;
  try {
    response = await fetch(`${API}${encodeURIComponent(word)}`);
  } catch {
    throw networkError('Could not reach the dictionary.');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw networkError(`Dictionary returned ${response.status}.`);
  try {
    return normalizeEntries(await response.json());
  } catch {
    throw networkError('Dictionary returned an unreadable response.');
  }
}

/**
 * Looks a single word up. Resolves to null when there is no entry (cached for one day so repeated
 * clicks don't hit the API); throws an AppError-shaped object on network failure.
 */
export async function getDefinition(word: string): Promise<DictResult | null> {
  const key = `dict:${word.toLowerCase()}`;
  return getOrFetch<DictResult | null>(
    key,
    async () => {
      const direct = await fetchEntry(word);
      if (direct) return direct;
      // Inflected forms ("houses", "walked") often have no entry of their own: try base forms.
      for (const candidate of lemmaCandidates(word).slice(0, MAX_LEMMA_RETRIES)) {
        const found = await fetchEntry(candidate);
        if (found) return found;
      }
      return null;
    },
    (value) => (value === null ? NEGATIVE_TTL_MS : DEFAULT_TTL_MS),
  );
}
