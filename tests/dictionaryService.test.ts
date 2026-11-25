import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefinition, normalizeEntries } from '../src/background/dictionaryService';

const entry = {
  word: 'reluctant',
  phonetic: '/rɪˈlʌktənt/',
  phonetics: [
    { text: '/rɪˈlʌktənt/', audio: '' },
    { text: '/rɪˈlʌktənt/', audio: '//api.dictionaryapi.dev/media/pronunciations/en/reluctant-us.mp3' },
  ],
  meanings: [
    {
      partOfSpeech: 'adjective',
      definitions: [
        { definition: 'Unwilling; disinclined.', example: 'She was reluctant to leave.' },
        { definition: 'Offering resistance.' },
        { definition: 'Third.' },
        { definition: 'Fourth (dropped).' },
      ],
    },
  ],
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeEntries', () => {
  it('normalises phonetic, https audio and up to 3 definitions per meaning', () => {
    const result = normalizeEntries([entry]);
    expect(result).toEqual({
      word: 'reluctant',
      phonetic: '/rɪˈlʌktənt/',
      audioUrl: 'https://api.dictionaryapi.dev/media/pronunciations/en/reluctant-us.mp3',
      meanings: [
        {
          partOfSpeech: 'adjective',
          definitions: [
            { definition: 'Unwilling; disinclined.', example: 'She was reluctant to leave.' },
            { definition: 'Offering resistance.' },
            { definition: 'Third.' },
          ],
        },
      ],
    });
  });

  it('rejects non-https audio URLs', () => {
    const result = normalizeEntries([{ ...entry, phonetics: [{ audio: 'http://evil.example/a.mp3' }] }]);
    expect(result?.audioUrl).toBeUndefined();
  });

  it('falls back to a phonetics[].text when there is no top-level phonetic', () => {
    const { phonetic: _ignored, ...rest } = entry;
    expect(normalizeEntries([rest])?.phonetic).toBe('/rɪˈlʌktənt/');
  });

  it('returns null for empty, malformed or definition-less data', () => {
    expect(normalizeEntries([])).toBeNull();
    expect(normalizeEntries({ title: 'No Definitions Found' })).toBeNull();
    expect(normalizeEntries([{ word: 'x', meanings: [{ partOfSpeech: 'noun', definitions: [] }] }])).toBeNull();
  });
});

describe('getDefinition', () => {
  it('fetches, normalises and caches a word', async () => {
    fetchMock.mockResolvedValue(json([entry]));
    const first = await getDefinition('Reluctant');
    expect(first?.word).toBe('reluctant');
    expect(fetchMock).toHaveBeenCalledWith('https://api.dictionaryapi.dev/api/v2/entries/en/Reluctant');
    await getDefinition('reluctant');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries with a base form on a 404 ("walked" -> "walk")', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/walked') ? json({}, 404) : json([{ ...entry, word: 'walk' }]),
    );
    const result = await getDefinition('walked');
    expect(result?.word).toBe('walk');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://api.dictionaryapi.dev/api/v2/entries/en/walked',
      'https://api.dictionaryapi.dev/api/v2/entries/en/walk',
    ]);
  });

  it('returns null (and caches it) when nothing is found', async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    expect(await getDefinition('zzzqx')).toBeNull();
    const calls = fetchMock.mock.calls.length;
    expect(await getDefinition('zzzqx')).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('throws a NETWORK error when fetch fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(getDefinition('hello')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('throws a NETWORK error on server errors and does not cache them', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json([entry]));
    await expect(getDefinition('hello')).rejects.toMatchObject({ code: 'NETWORK' });
    expect((await getDefinition('hello'))?.word).toBe('reluctant');
  });

  it('throws a NETWORK error on an unreadable body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(getDefinition('hello')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('encodes the word in the URL', async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await getDefinition('a b/c');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.dictionaryapi.dev/api/v2/entries/en/a%20b%2Fc');
  });
});
