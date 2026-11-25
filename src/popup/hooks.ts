import { useCallback, useEffect, useState } from 'react';
import {
  getSavedWords,
  getSettings,
  onSavedWordsChanged,
  onSettingsChanged,
  setSettings,
} from '../shared/storage';
import {
  DEFAULT_SETTINGS,
  type BgRequest,
  type ContentState,
  type Result,
  type SavedWord,
  type Settings,
} from '../shared/types';

/** Settings from `chrome.storage.sync`, kept live; `update` saves immediately. */
export function useSettings(): {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
} {
  const [settings, setLocal] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSettings().then((s) => {
      if (!alive) return;
      setLocal(s);
      setLoaded(true);
    });
    const off = onSettingsChanged((s) => alive && setLocal(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    void setSettings(patch);
  }, []);

  return { settings, loaded, update };
}

export function useSavedWords(): SavedWord[] {
  const [words, setWords] = useState<SavedWord[]>([]);
  useEffect(() => {
    let alive = true;
    void getSavedWords().then((w) => alive && setWords(w));
    const off = onSavedWordsChanged((w) => alive && setWords(w));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return words;
}

/** Sends a message to the background worker. */
export async function sendBg<T>(request: BgRequest): Promise<Result<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as Result<T> | undefined;
    return response ?? { ok: false, error: { code: 'UNKNOWN', message: 'No response.' } };
  } catch {
    return { ok: false, error: { code: 'UNKNOWN', message: 'Extension is not available.' } };
  }
}

export type KeySource = 'user' | 'built-in' | null;

/**
 * Which API key is in use (asked of the background; the key itself never reaches the UI):
 * 'user' = entered in Settings, 'built-in' = baked into this build, null = none.
 */
export function useKeyInfo(): { hasKey: boolean; source: KeySource; refresh: () => void } {
  const [source, setSource] = useState<KeySource>(null);
  const refresh = useCallback(() => {
    void sendBg<KeySource>({ type: 'KEY_SOURCE' }).then((r) => setSource(r.ok ? r.data : null));
  }, []);
  useEffect(refresh, [refresh]);
  return { hasKey: source !== null, source, refresh };
}

const STATE_POLL_MS = 1500;

/** State of the content script in the active tab, polled while the popup is open. Null if none answers. */
export function useActiveTabState(): ContentState | null {
  const [state, setState] = useState<ContentState | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async (): Promise<void> => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('no tab');
        const response = (await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' })) as
          | ContentState
          | undefined;
        if (alive) setState(response ?? null);
      } catch {
        if (alive) setState(null);
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), STATE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return state;
}
