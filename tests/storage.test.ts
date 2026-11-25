import { describe, expect, it, vi } from 'vitest';
import {
  getApiKey,
  getSavedWords,
  getSettings,
  onSavedWordsChanged,
  onSettingsChanged,
  removeWord,
  saveWord,
  setApiKey,
  setSettings,
} from '../src/shared/storage';
import { DEFAULT_SETTINGS, type SavedWord } from '../src/shared/types';
import { chromeMock } from './setup';

function word(id: string, term = id): SavedWord {
  return {
    id,
    term,
    definition: 'd',
    context: 'c',
    level: 'B2',
    estimated: true,
    partOfSpeech: 'noun',
    site: 'youtube',
    pageTitle: 't',
    url: 'https://www.youtube.com/watch?v=1',
    savedAt: 1,
  };
}

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a patch over defaults and persists it in sync storage', async () => {
    const next = await setSettings({ level: 'C1', smartPause: false });
    expect(next.level).toBe('C1');
    expect(next.enabled).toBe(true);
    expect(await getSettings()).toEqual(next);
    expect(chromeMock.storage.sync.__dump()['settings']).toEqual(next);
    expect(chromeMock.storage.local.__dump()['settings']).toBeUndefined();
  });
});

describe('api key', () => {
  it('is stored in local storage only, never sync', async () => {
    await setApiKey('  sk-ant-test  ');
    expect(await getApiKey()).toBe('sk-ant-test');
    expect(chromeMock.storage.local.__dump()['apiKey']).toBe('sk-ant-test');
    expect(JSON.stringify(chromeMock.storage.sync.__dump())).not.toContain('sk-ant-test');
  });

  it('is removed by null or an empty string', async () => {
    await setApiKey('sk-ant-test');
    await setApiKey(null);
    expect(await getApiKey()).toBeNull();
    await setApiKey('sk-ant-test');
    await setApiKey('   ');
    expect(await getApiKey()).toBeNull();
  });
});

describe('saved words', () => {
  it('adds newest first and replaces words with the same id', async () => {
    await saveWord(word('a'));
    await saveWord(word('b'));
    await saveWord(word('a', 'a-updated'));
    const words = await getSavedWords();
    expect(words.map((w) => w.id)).toEqual(['a', 'b']);
    expect(words[0]?.term).toBe('a-updated');
  });

  it('removes a word by id', async () => {
    await saveWord(word('a'));
    await saveWord(word('b'));
    await removeWord('a');
    expect((await getSavedWords()).map((w) => w.id)).toEqual(['b']);
  });
});

describe('change subscriptions', () => {
  it('notifies when settings change and stops after unsubscribe', async () => {
    const cb = vi.fn();
    const unsubscribe = onSettingsChanged(cb);
    await setSettings({ level: 'C2' });
    await vi.waitFor(() => expect(cb).toHaveBeenCalledTimes(1));
    expect(cb.mock.calls[0]?.[0]).toMatchObject({ level: 'C2' });
    unsubscribe();
    await setSettings({ level: 'B1' });
    await new Promise((r) => setTimeout(r, 10));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies when saved words change', async () => {
    const cb = vi.fn();
    onSavedWordsChanged(cb);
    await saveWord(word('a'));
    await vi.waitFor(() => expect(cb).toHaveBeenCalledTimes(1));
    expect(cb.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
