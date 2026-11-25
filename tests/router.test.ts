import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessage } from '../src/background/router';
import { getApiKey, getSavedWords, setApiKey, setSettings } from '../src/shared/storage';
import type { AiExplanation, LookupData, SavedWord } from '../src/shared/types';
import { chromeMock } from './setup';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const explanation: AiExplanation = {
  lemma: 'x', ipa: 'eks', partOfSpeech: 'noun', isIdiom: false, register: 'neutral', cefr: 'B2',
  shortDefinition: 'short', inContext: 'in context', example: 'an example', simpler: 'easier',
};

const saved = (id: string): SavedWord => ({
  id,
  term: id,
  definition: 'd',
  context: 'c',
  level: 'B2',
  estimated: true,
  partOfSpeech: 'noun',
  site: 'youtube',
  pageTitle: 't',
  url: 'https://www.youtube.com/watch?v=1',
  savedAt: 1,
});

describe('LOOKUP', () => {
  it('looks up a single word and attaches an estimated level', async () => {
    fetchMock.mockResolvedValue(
      json([{ word: 'house', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A building.' }] }] }]),
    );
    const res = await handleMessage({ type: 'LOOKUP', term: 'house', isPhrase: false });
    expect(res.ok).toBe(true);
    const data = (res as { ok: true; data: LookupData }).data;
    expect(data.dictionary?.meanings[0]?.definitions[0]?.definition).toBe('A building.');
    expect(data.level).toEqual({ level: 'A2', estimated: true });
  });

  it('returns dictionary: null (not an error) when there is no entry', async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    const res = await handleMessage({ type: 'LOOKUP', term: 'zzzqx', isPhrase: false });
    expect(res).toMatchObject({ ok: true, data: { dictionary: null } });
  });

  it('answers known idioms from the bundled meaning without calling the dictionary', async () => {
    const res = await handleMessage({
      type: 'LOOKUP',
      term: 'broke the ice',
      isPhrase: true,
      phraseMeaning: 'To make people feel relaxed.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      ok: true,
      data: {
        level: { level: 'B2', estimated: true },
        dictionary: {
          meanings: [{ partOfSpeech: 'idiom', definitions: [{ definition: 'To make people feel relaxed.' }] }],
        },
      },
    });
  });

  it('returns dictionary: null for an unknown selected phrase', async () => {
    const res = await handleMessage({ type: 'LOOKUP', term: 'some random words', isPhrase: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, data: { dictionary: null } });
  });

  it('maps a network failure to an error result', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const res = await handleMessage({ type: 'LOOKUP', term: 'hello', isPhrase: false });
    expect(res).toMatchObject({ ok: false, error: { code: 'NETWORK' } });
  });
});

describe('key resolution (user key over built-in demo key)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const explainReq = { type: 'EXPLAIN', term: 'x', context: 'y', level: 'B2', pageTitle: 't' } as const;
  const okResponse = (): Response =>
    new Response(
      JSON.stringify({
        id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(explanation) }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  const sentKey = (): string | null =>
    new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('x-api-key');

  it('reports no key and no source when neither exists', async () => {
    expect(await handleMessage({ type: 'KEY_SOURCE' })).toEqual({ ok: true, data: null });
    expect(await handleMessage({ type: 'HAS_KEY' })).toEqual({ ok: true, data: false });
  });

  it('uses the built-in key when the user has not entered one, without ever returning it', async () => {
    vi.stubEnv('VITE_EMBEDDED_API_KEY', '  sk-embedded  ');
    expect(await handleMessage({ type: 'HAS_KEY' })).toEqual({ ok: true, data: true });
    const source = await handleMessage({ type: 'KEY_SOURCE' });
    expect(source).toEqual({ ok: true, data: 'built-in' });

    fetchMock.mockResolvedValue(okResponse());
    const res = await handleMessage(explainReq);
    expect(res.ok).toBe(true);
    expect(sentKey()).toBe('sk-embedded');
    expect(JSON.stringify(res)).not.toContain('sk-embedded');
    expect(JSON.stringify(source)).not.toContain('sk-embedded');
  });

  it('lets a key entered by the user win over the built-in one', async () => {
    vi.stubEnv('VITE_EMBEDDED_API_KEY', 'sk-embedded');
    await setApiKey('sk-ant-user');
    expect(await handleMessage({ type: 'KEY_SOURCE' })).toEqual({ ok: true, data: 'user' });
    fetchMock.mockResolvedValue(okResponse());
    await handleMessage(explainReq);
    expect(sentKey()).toBe('sk-ant-user');
  });

  it('TEST_KEY with nothing typed tests the built-in key', async () => {
    vi.stubEnv('VITE_EMBEDDED_API_KEY', 'sk-embedded');
    fetchMock.mockResolvedValue(okResponse());
    expect(await handleMessage({ type: 'TEST_KEY' })).toEqual({ ok: true, data: null });
    expect(sentKey()).toBe('sk-embedded');
  });

  it('ignores an empty or whitespace-only built-in key', async () => {
    vi.stubEnv('VITE_EMBEDDED_API_KEY', '   ');
    expect(await handleMessage({ type: 'KEY_SOURCE' })).toEqual({ ok: true, data: null });
    expect(await handleMessage(explainReq)).toMatchObject({ ok: false, error: { code: 'NO_KEY' } });
  });
});

describe('other messages', () => {
  it('HAS_KEY reports whether a key is stored, without returning it', async () => {
    expect(await handleMessage({ type: 'HAS_KEY' })).toEqual({ ok: true, data: false });
    await setApiKey('sk-ant-secret');
    const res = await handleMessage({ type: 'HAS_KEY' });
    expect(res).toEqual({ ok: true, data: true });
    expect(JSON.stringify(res)).not.toContain('sk-ant-secret');
  });

  it('SAVE_WORD and REMOVE_WORD update the saved list', async () => {
    await handleMessage({ type: 'SAVE_WORD', word: saved('a') });
    await handleMessage({ type: 'SAVE_WORD', word: saved('b') });
    expect((await getSavedWords()).map((w) => w.id)).toEqual(['b', 'a']);
    await handleMessage({ type: 'REMOVE_WORD', id: 'b' });
    expect((await getSavedWords()).map((w) => w.id)).toEqual(['a']);
  });

  it('CLEAR_CACHE clears the cache but keeps the API key', async () => {
    await setApiKey('sk-ant-secret');
    await chromeMock.storage.local.set({ 'dict:x': { v: 1, savedAt: 1 }, cacheIndex: [{ key: 'dict:x', savedAt: 1 }] });
    expect(await handleMessage({ type: 'CLEAR_CACHE' })).toEqual({ ok: true, data: null });
    expect(chromeMock.storage.local.__dump()['dict:x']).toBeUndefined();
    expect(await getApiKey()).toBe('sk-ant-secret');
  });

  it('EXPLAIN returns NO_KEY when no key is stored', async () => {
    const res = await handleMessage({ type: 'EXPLAIN', term: 'x', context: 'y', level: 'B2', pageTitle: 't' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NO_KEY' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('EXPLAIN uses the stored key and the model from settings', async () => {
    await setApiKey('sk-ant-secret');
    await setSettings({ aiModel: 'claude-haiku-5-5' });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
          content: [{ type: 'text', text: JSON.stringify(explanation) }],
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const res = await handleMessage({ type: 'EXPLAIN', term: 'x', context: 'y', level: 'B2', pageTitle: 't' });
    expect(res).toEqual({ ok: true, data: explanation });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('x-api-key')).toBe('sk-ant-secret');
    expect(JSON.parse(init.body as string).model).toBe('claude-haiku-5-5');
    expect(JSON.stringify(res)).not.toContain('sk-ant-secret');
  });

  it('EXPLAIN maps an invalid key to INVALID_KEY', async () => {
    await setApiKey('sk-ant-bad');
    fetchMock.mockResolvedValue(
      new Response('{"type":"error","error":{"type":"authentication_error","message":"x"}}', {
        status: 401,
        headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
      }),
    );
    const res = await handleMessage({ type: 'EXPLAIN', term: 'x', context: 'y', level: 'B2', pageTitle: 't' });
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_KEY' } });
  });

  it('TEST_KEY needs a key, and tests a typed key without storing it', async () => {
    expect(await handleMessage({ type: 'TEST_KEY' })).toMatchObject({ ok: false, error: { code: 'NO_KEY' } });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
          content: [{ type: 'text', text: JSON.stringify(explanation) }],
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    expect(await handleMessage({ type: 'TEST_KEY', apiKey: 'sk-ant-typed' })).toEqual({ ok: true, data: null });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('x-api-key')).toBe('sk-ant-typed');
    expect(await getApiKey()).toBeNull();
  });

  it('OPEN_SETTINGS flags the Settings tab and opens the popup', async () => {
    const openPopup = vi.fn(async () => undefined);
    (chromeMock as unknown as { action: { openPopup: typeof openPopup } }).action = { openPopup };
    expect(await handleMessage({ type: 'OPEN_SETTINGS' })).toEqual({ ok: true, data: null });
    expect(openPopup).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.local.__dump()['popupTab']).toBe('settings');
  });

  it('OPEN_SETTINGS reports failure when Chrome refuses to open the popup', async () => {
    (chromeMock as unknown as { action: { openPopup: () => Promise<void> } }).action = {
      openPopup: async () => {
        throw new Error('No active browser window');
      },
    };
    expect(await handleMessage({ type: 'OPEN_SETTINGS' })).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN' },
    });
  });

  it('rejects unknown message types without throwing', async () => {
    const res = await handleMessage({ type: 'NOPE' } as never);
    expect(res).toMatchObject({ ok: false, error: { code: 'UNKNOWN' } });
  });
});
