import { useState, type ReactNode } from 'react';
import { API_HOST } from '../../shared/apiConfig';
import { setApiKey } from '../../shared/storage';
import type { AiModel, AppError, CardTrigger, Settings } from '../../shared/types';
import { sendBg, type KeySource } from '../hooks';
import { Row, Switch, buttonClass, focusRing } from './ui';

const MODELS: ReadonlyArray<{ id: AiModel; label: string }> = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
];

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

/** Copy for key-test failures (docs/03 §7.3). */
export function keyErrorCopy(error: AppError): string {
  switch (error.code) {
    case 'INVALID_KEY':
      return 'Your API key was rejected. Check that you copied it fully.';
    case 'RATE_LIMIT':
      return 'Too many requests — try again in a moment.';
    case 'NETWORK':
      return 'Couldn’t reach the AI service.';
    case 'NO_KEY':
      return 'Enter a key first.';
    default:
      return 'Couldn’t verify the key.';
  }
}

export function SettingsTab(props: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  keySource: KeySource;
  onKeyChanged: () => void;
}): ReactNode {
  const { settings, update, keySource, onKeyChanged } = props;
  const hasKey = keySource !== null;
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [cacheCleared, setCacheCleared] = useState(false);

  const saveKey = async (): Promise<void> => {
    if (draft.trim() === '') return;
    await setApiKey(draft);
    setDraft('');
    setShow(false);
    setTest({ kind: 'idle' });
    onKeyChanged();
  };

  const removeKey = async (): Promise<void> => {
    await setApiKey(null);
    setTest({ kind: 'idle' });
    onKeyChanged();
  };

  const testKey = async (): Promise<void> => {
    setTest({ kind: 'testing' });
    const result = await sendBg<null>({ type: 'TEST_KEY', ...(draft.trim() ? { apiKey: draft.trim() } : {}) });
    setTest(result.ok ? { kind: 'ok' } : { kind: 'error', message: keyErrorCopy(result.error) });
  };

  const clearCache = async (): Promise<void> => {
    await sendBg<null>({ type: 'CLEAR_CACHE' });
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2" aria-labelledby="key-heading">
        <h2 id="key-heading" className="text-sm font-semibold">
          Anthropic API key
        </h2>
        <div className="flex gap-2">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              keySource === 'user'
                ? '•••••••• (saved)'
                : keySource === 'built-in'
                  ? 'Enter your own key to override'
                  : 'sk-ant-…'
            }
            aria-label="Anthropic API key"
            autoComplete="off"
            spellCheck={false}
            className={`min-w-0 flex-1 rounded-lg border border-light-border bg-transparent px-3 py-1.5 text-sm dark:border-white/15 ${focusRing}`}
          />
          <button type="button" className={buttonClass} onClick={() => setShow((s) => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        {keySource === 'built-in' && (
          <p className="rounded-lg bg-black/5 px-3 py-2 text-xs dark:bg-white/10">
            This build includes a built-in demo key, so AI Mode works without entering one. A key you save here
            overrides it.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} disabled={draft.trim() === ''} onClick={() => void saveKey()}>
            Save
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={test.kind === 'testing' || (!hasKey && draft.trim() === '')}
            onClick={() => void testKey()}
          >
            {test.kind === 'testing' ? 'Testing…' : 'Test key'}
          </button>
          {keySource === 'user' && (
            <button type="button" className={`${buttonClass} text-danger`} onClick={() => void removeKey()}>
              Remove
            </button>
          )}
        </div>
        <div role="status" aria-live="polite" className="min-h-5 text-sm">
          {test.kind === 'ok' && <span className="text-success">✓ Key works</span>}
          {test.kind === 'error' && <span className="text-danger">{test.message}</span>}
        </div>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className={`text-xs text-light-accent underline-offset-2 hover:underline dark:text-accent ${focusRing}`}
        >
          Get a key at console.anthropic.com
        </a>
      </section>

      <section className="flex flex-col gap-1">
        <label htmlFor="model" className="text-sm font-semibold">
          Model
        </label>
        <select
          id="model"
          value={settings.aiModel}
          onChange={(e) => update({ aiModel: e.target.value as AiModel })}
          className={`rounded-lg border border-light-border bg-transparent px-3 py-1.5 text-sm dark:border-white/15 dark:bg-dark-bg ${focusRing}`}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-light-secondary dark:text-dark-secondary">
          Haiku is the fastest and cheapest; Opus gives the richest explanations.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <Row label="Card opens on">
          <div role="radiogroup" aria-label="Card trigger" className="flex gap-3 text-sm">
            {(['click', 'hover'] as const satisfies readonly CardTrigger[]).map((trigger) => (
              <label key={trigger} className="flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="trigger"
                  checked={settings.cardTrigger === trigger}
                  onChange={() => update({ cardTrigger: trigger })}
                />
                {trigger === 'click' ? 'Click' : 'Hover'}
              </label>
            ))}
          </div>
        </Row>
        <Row label="Smart pause">
          <Switch
            label="Smart pause"
            checked={settings.smartPause}
            onChange={(smartPause) => update({ smartPause })}
          />
        </Row>
        <Row label="Cache">
          <button type="button" className={buttonClass} onClick={() => void clearCache()}>
            {cacheCleared ? 'Cache cleared' : 'Clear cache'}
          </button>
        </Row>
      </section>

      <p className="text-xs leading-relaxed text-light-secondary dark:text-dark-secondary">
        Your key is stored only in this browser and is sent only to {API_HOST}. Words you look up are sent to
        dictionaryapi.dev (and, with the surrounding caption line, to {API_HOST} in AI Mode).
      </p>
    </div>
  );
}
