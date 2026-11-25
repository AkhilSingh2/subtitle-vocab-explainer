import { DEFAULT_SETTINGS, type SavedWord, type Settings } from './types';

const SETTINGS_KEY = 'settings';
const API_KEY_KEY = 'apiKey';
const SAVED_WORDS_KEY = 'savedWords';

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const value = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

/** The API key lives in `local` only — never `sync`. */
export async function getApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(API_KEY_KEY);
  const key = stored[API_KEY_KEY];
  return typeof key === 'string' && key.length > 0 ? key : null;
}

export async function setApiKey(key: string | null): Promise<void> {
  if (key === null || key.trim() === '') {
    await chrome.storage.local.remove(API_KEY_KEY);
    return;
  }
  await chrome.storage.local.set({ [API_KEY_KEY]: key.trim() });
}

export async function getSavedWords(): Promise<SavedWord[]> {
  const stored = await chrome.storage.local.get(SAVED_WORDS_KEY);
  const words = stored[SAVED_WORDS_KEY];
  return Array.isArray(words) ? (words as SavedWord[]) : [];
}

/** Adds the word, or replaces an existing one with the same id. Newest first. */
export async function saveWord(word: SavedWord): Promise<void> {
  const words = (await getSavedWords()).filter((w) => w.id !== word.id);
  words.unshift(word);
  await chrome.storage.local.set({ [SAVED_WORDS_KEY]: words });
}

export async function removeWord(id: string): Promise<void> {
  const words = (await getSavedWords()).filter((w) => w.id !== id);
  await chrome.storage.local.set({ [SAVED_WORDS_KEY]: words });
}

type Unsubscribe = () => void;

function subscribe(area: 'sync' | 'local', key: string, cb: () => void): Unsubscribe {
  const listener = (changes: Record<string, unknown>, areaName: string): void => {
    if (areaName === area && key in changes) cb();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function onSettingsChanged(cb: (settings: Settings) => void): Unsubscribe {
  return subscribe('sync', SETTINGS_KEY, () => {
    void getSettings().then(cb);
  });
}

export function onSavedWordsChanged(cb: (words: SavedWord[]) => void): Unsubscribe {
  return subscribe('local', SAVED_WORDS_KEY, () => {
    void getSavedWords().then(cb);
  });
}
