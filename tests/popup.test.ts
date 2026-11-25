import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/popup/App';
import { API_HOST } from '../src/shared/apiConfig';
import { getSettings } from '../src/shared/storage';
import type { BgRequest, ContentState, Result, SavedWord } from '../src/shared/types';
import { chromeMock } from './setup';
import { byText, choose, click, createElement, flush, mount, typeInto, type Mounted } from './uiHelpers';

let mounted: Mounted | null = null;
let sent: BgRequest[];
let tabResponse: ContentState | undefined;
let testKeyResult: Result<null>;
let builtInKey: boolean;

function word(term: string, over: Partial<SavedWord> = {}): SavedWord {
  return {
    id: `${term}|x`,
    term,
    definition: `Definition of ${term}.`,
    context: `We used ${term} here.`,
    level: 'B2',
    estimated: true,
    partOfSpeech: 'noun',
    site: 'youtube',
    pageTitle: 'My Talk',
    url: 'https://www.youtube.com/watch?v=1',
    savedAt: Date.now() - 120_000,
    ...over,
  };
}

async function open(): Promise<HTMLElement> {
  mounted = await mount(createElement(App));
  await flush();
  return mounted.container;
}

beforeEach(() => {
  sent = [];
  tabResponse = undefined;
  testKeyResult = { ok: true, data: null };
  builtInKey = false;
  chromeMock.runtime.sendMessage.mockImplementation(async (req: BgRequest) => {
    sent.push(req);
    if (req.type === 'HAS_KEY') {
      const stored = await chromeMock.storage.local.get('apiKey');
      return { ok: true, data: typeof stored['apiKey'] === 'string' };
    }
    if (req.type === 'KEY_SOURCE') {
      const stored = await chromeMock.storage.local.get('apiKey');
      const source = typeof stored['apiKey'] === 'string' ? 'user' : builtInKey ? 'built-in' : null;
      return { ok: true, data: source };
    }
    if (req.type === 'TEST_KEY') return testKeyResult;
    return { ok: true, data: null };
  });
  chromeMock.tabs.query.mockImplementation(async () => (tabResponse ? [{ id: 7 }] : []));
  chromeMock.tabs.sendMessage.mockImplementation(async () => tabResponse);
});

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  document.body.innerHTML = '';
});

describe('popup shell and Home tab', () => {
  it('renders the header, three tabs and the free-mode defaults', async () => {
    const root = await open();
    expect(root.textContent).toContain('Subtitle Vocab Explainer');
    expect(Array.from(root.querySelectorAll('[role="tab"]')).map((t) => t.textContent)).toEqual([
      'Home',
      'Words (0)',
      'Settings',
    ]);
    expect(root.textContent).toContain('Open a YouTube or Netflix video');
    expect(root.textContent).toContain('Free ·');
    expect(root.textContent).toContain('Click any caption word to start your list.');
    expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('Home');
  });

  it('shows the live status from the active tab', async () => {
    tabResponse = { site: 'netflix', isWatchPage: true, captionsStatus: 'detected', enabled: true };
    const root = await open();
    expect(root.textContent).toContain('Active on Netflix — captions detected');
  });

  it('turns the extension on and off and persists it', async () => {
    const root = await open();
    expect(root.querySelector('[role="switch"][aria-label="Turn extension on or off"]')?.getAttribute('aria-checked')).toBe('true');
    await click(root.querySelector('[role="switch"][aria-label="Turn extension on or off"]'));
    await flush();
    expect((await getSettings()).enabled).toBe(false);
    expect(root.textContent).toContain('OFF');
    expect(root.textContent).toContain('Paused — turn on to use');
  });

  it('saves the level choice', async () => {
    const root = await open();
    await click(byText(root, '[role="radio"]', 'C1'));
    await flush();
    expect((await getSettings()).level).toBe('C1');
    expect(byText(root, '[role="radio"]', 'C1')?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows "AI ✓" once a key exists and the three most recent saved words', async () => {
    await chromeMock.storage.local.set({
      apiKey: 'sk-ant-x',
      savedWords: ['a', 'b', 'c', 'd'].map((t, i) => word(t, { savedAt: Date.now() - i * 60_000 })),
    });
    const root = await open();
    expect(root.textContent).toContain('AI ✓ (Claude)');
    const recent = root.querySelectorAll('section ul li');
    expect(recent).toHaveLength(3);
    expect(root.textContent).toContain('see all →');
  });

  it('navigates with "add AI key →" and "see all →"', async () => {
    await chromeMock.storage.local.set({ savedWords: [word('alpha')] });
    const root = await open();
    await click(byText(root, 'button', 'see all'));
    expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('Words (1)');
    await click(byText(root, '[role="tab"]', 'Home'));
    await click(byText(root, 'button', 'add AI key'));
    expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('Settings');
  });

  it('opens on the Settings tab when the background asked for it, once', async () => {
    await chromeMock.storage.local.set({ popupTab: 'settings' });
    const root = await open();
    expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('Settings');
    expect(chromeMock.storage.local.__dump()['popupTab']).toBeUndefined();
  });
});

describe('Words tab', () => {
  beforeEach(async () => {
    await chromeMock.storage.local.set({
      savedWords: [
        word('reluctant', { definition: 'Unwilling.', level: 'C1', estimated: false }),
        word('break the ice', { partOfSpeech: 'idiom', site: 'netflix' }),
      ],
    });
  });

  const openWords = async (): Promise<HTMLElement> => {
    const root = await open();
    await click(byText(root, '[role="tab"]', 'Words'));
    return root;
  };

  it('lists words with level badges and relative time', async () => {
    const root = await openWords();
    expect(root.textContent).toContain('reluctant');
    expect(root.textContent).toContain('break the ice');
    expect(root.textContent).toContain('2m ago');
    expect(root.textContent).toContain('est. B2');
    expect(root.textContent).toContain('C1');
  });

  it('filters with the search box', async () => {
    const root = await openWords();
    await typeInto(root.querySelector('input[type="search"]') as HTMLInputElement, 'unwill');
    expect(root.textContent).toContain('reluctant');
    expect(root.textContent).not.toContain('break the ice');
    await typeInto(root.querySelector('input[type="search"]') as HTMLInputElement, 'zzz');
    expect(root.textContent).toContain('No saved words match');
  });

  it('expands a row to show definition, context and source', async () => {
    const root = await openWords();
    await click(byText(root, 'button[aria-expanded]', 'break the ice'));
    expect(root.textContent).toContain('Definition of break the ice.');
    expect(root.textContent).toContain('“We used break the ice here.”');
    const link = root.querySelector('a[href^="https://www.youtube.com"]');
    expect(link?.textContent).toBe('Netflix · My Talk');
    expect(link?.getAttribute('rel')).toBe('noreferrer');
  });

  it('deletes a word', async () => {
    const root = await openWords();
    await click(byText(root, 'button[aria-expanded]', 'break the ice'));
    await click(root.querySelector('[aria-label="Delete break the ice"]'));
    await flush();
    const stored = (await chromeMock.storage.local.get('savedWords'))['savedWords'] as SavedWord[];
    expect(stored.map((w) => w.term)).toEqual(['reluctant']);
    expect(root.textContent).not.toContain('break the ice');
  });

  it('exports a UTF-8 BOM CSV with the right file name', async () => {
    const blobs: Blob[] = [];
    const created = vi.fn((b: Blob) => (blobs.push(b), 'blob:test'));
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = created;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });

    const root = await openWords();
    await click(byText(root, 'button', 'Export CSV'));

    expect(downloads[0]).toMatch(/^vocab-\d{4}-\d{2}-\d{2}\.csv$/);
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blobs[0] as Blob);
    });
    // UTF-8 BOM so Excel detects the encoding (readAsText would strip it, so inspect raw bytes).
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(text.slice(1).startsWith('word,definition')).toBe(true);
    expect(text).toContain('"reluctant"');
    clickSpy.mockRestore();
  });
});

describe('Settings tab', () => {
  const openSettings = async (): Promise<HTMLElement> => {
    const root = await open();
    await click(byText(root, '[role="tab"]', 'Settings'));
    return root;
  };
  const keyInput = (root: HTMLElement): HTMLInputElement =>
    root.querySelector('input[aria-label="Anthropic API key"]') as HTMLInputElement;

  it('hides the key by default and can show it', async () => {
    const root = await openSettings();
    expect(keyInput(root).type).toBe('password');
    await click(byText(root, 'button', 'Show'));
    expect(keyInput(root).type).toBe('text');
  });

  it('saves the key to local storage only (never sync) and then reports AI mode', async () => {
    const root = await openSettings();
    expect((byText(root, 'button', 'Save') as HTMLButtonElement).disabled).toBe(true);
    await typeInto(keyInput(root), '  sk-ant-secret  ');
    await click(byText(root, 'button', 'Save'));
    await flush();
    expect(chromeMock.storage.local.__dump()['apiKey']).toBe('sk-ant-secret');
    expect(JSON.stringify(chromeMock.storage.sync.__dump())).not.toContain('sk-ant');
    expect(keyInput(root).value).toBe('');
    expect(keyInput(root).placeholder).toContain('saved');
    expect(byText(root, 'button', 'Remove')).not.toBeNull();
  });

  it('tests a typed key before saving it', async () => {
    const root = await openSettings();
    expect((byText(root, 'button', 'Test key') as HTMLButtonElement).disabled).toBe(true);
    await typeInto(keyInput(root), 'sk-ant-typed');
    await click(byText(root, 'button', 'Test key'));
    await flush();
    expect(sent.find((r) => r.type === 'TEST_KEY')).toEqual({ type: 'TEST_KEY', apiKey: 'sk-ant-typed' });
    expect(root.textContent).toContain('✓ Key works');
    expect(chromeMock.storage.local.__dump()['apiKey']).toBeUndefined();
  });

  it('shows readable copy when the key test fails', async () => {
    testKeyResult = { ok: false, error: { code: 'INVALID_KEY', message: '' } };
    const root = await openSettings();
    await typeInto(keyInput(root), 'bad');
    await click(byText(root, 'button', 'Test key'));
    await flush();
    expect(root.textContent).toContain('Your API key was rejected. Check that you copied it fully.');
    expect(root.textContent).not.toContain('✓ Key works');
  });

  it('explains the built-in demo key, hides Remove, and lets the user override it', async () => {
    builtInKey = true;
    const root = await openSettings();
    expect(root.textContent).toContain('built-in demo key');
    expect(keyInput(root).placeholder).toBe('Enter your own key to override');
    expect(byText(root, 'button', 'Remove')).toBeNull();
    // AI Mode is on, so Test key is enabled without typing anything
    expect((byText(root, 'button', 'Test key') as HTMLButtonElement).disabled).toBe(false);

    await typeInto(keyInput(root), 'sk-ant-mine');
    await click(byText(root, 'button', 'Save'));
    await flush();
    expect(root.textContent).not.toContain('built-in demo key');
    expect(byText(root, 'button', 'Remove')).not.toBeNull();
  });

  it('removes a saved key', async () => {
    await chromeMock.storage.local.set({ apiKey: 'sk-ant-x' });
    const root = await openSettings();
    await click(byText(root, 'button', 'Remove'));
    await flush();
    expect(chromeMock.storage.local.__dump()['apiKey']).toBeUndefined();
    expect(byText(root, 'button', 'Remove')).toBeNull();
  });

  it('saves model, trigger and smart-pause changes immediately', async () => {
    const root = await openSettings();
    await choose(root.querySelector('#model') as HTMLSelectElement, 'claude-haiku-5-5');
    await click(root.querySelector('input[type="radio"][name="trigger"]:not(:checked)'));
    await click(root.querySelector('[role="switch"][aria-label="Smart pause"]'));
    await flush();
    const settings = await getSettings();
    expect(settings.aiModel).toBe('claude-haiku-5-5');
    expect(settings.cardTrigger).toBe('hover');
    expect(settings.smartPause).toBe(false);
  });

  it('offers exactly the three Claude models', async () => {
    const root = await openSettings();
    const values = Array.from(root.querySelectorAll('#model option')).map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
  });

  it('clears the cache and says so', async () => {
    const root = await openSettings();
    await click(byText(root, 'button', 'Clear cache'));
    await flush();
    expect(sent.some((r) => r.type === 'CLEAR_CACHE')).toBe(true);
    expect(root.textContent).toContain('Cache cleared');
  });

  it('shows the privacy note', async () => {
    const root = await openSettings();
    expect(root.textContent).toContain(`sent only to ${API_HOST}`);
  });
});
