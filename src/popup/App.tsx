import { useEffect, useState, type ReactNode } from 'react';
import { HomeTab, type TabId } from './components/HomeTab';
import { SettingsTab } from './components/SettingsTab';
import { WordsTab } from './components/WordsTab';
import { Switch, focusRing } from './components/ui';
import { useActiveTabState, useKeyInfo, useSavedWords, useSettings } from './hooks';

/** The background can ask the popup to open on a given tab (e.g. from the card's "add AI key" nudge). */
async function consumeRequestedTab(): Promise<TabId | null> {
  const stored = await chrome.storage.local.get('popupTab');
  const tab = stored['popupTab'];
  if (tab === undefined) return null;
  await chrome.storage.local.remove('popupTab');
  return tab === 'settings' || tab === 'words' || tab === 'home' ? tab : null;
}

export function App(): ReactNode {
  const { settings, update } = useSettings();
  const words = useSavedWords();
  const { hasKey, source: keySource, refresh } = useKeyInfo();
  const state = useActiveTabState();
  const [tab, setTab] = useState<TabId>('home');

  useEffect(() => {
    let alive = true;
    void consumeRequestedTab().then((requested) => {
      if (alive && requested) setTab(requested);
    });
    return () => {
      alive = false;
    };
  }, []);

  const tabs: ReadonlyArray<{ id: TabId; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'words', label: `Words (${words.length})` },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <main className="flex h-[520px] w-[360px] flex-col bg-light-bg font-sans text-light-text dark:bg-dark-bg dark:text-dark-text">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h1 className="text-sm font-semibold">Subtitle Vocab Explainer</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-light-secondary dark:text-dark-secondary">
            {settings.enabled ? 'ON' : 'OFF'}
          </span>
          <Switch
            label="Turn extension on or off"
            checked={settings.enabled}
            onChange={(enabled) => update({ enabled })}
          />
        </div>
      </header>

      <nav role="tablist" aria-label="Sections" className="flex border-b border-light-border px-4 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${focusRing} ${
              tab === t.id
                ? 'border-light-accent text-light-text dark:border-accent dark:text-dark-text'
                : 'border-transparent text-light-secondary dark:text-dark-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {tab === 'home' && (
          <HomeTab state={state} settings={settings} update={update} hasKey={hasKey} words={words} goTo={setTab} />
        )}
        {tab === 'words' && <WordsTab words={words} />}
        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            update={update}
            keySource={keySource}
            onKeyChanged={refresh}
          />
        )}
      </div>
    </main>
  );
}
