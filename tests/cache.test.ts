import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTL_MS, NEGATIVE_TTL_MS, clearCache, getOrFetch } from '../src/background/cache';
import { chromeMock } from './setup';

afterEach(() => {
  vi.useRealTimers();
});

describe('getOrFetch', () => {
  it('calls the loader on a miss, stores the value and serves the next call from the cache', async () => {
    const loader = vi.fn(async () => 'value');
    expect(await getOrFetch('k', loader)).toBe('value');
    expect(await getOrFetch('k', loader)).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.local.__dump()['k']).toMatchObject({ v: 'value' });
  });

  it('refetches after the TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const loader = vi.fn(async () => 'v');
    await getOrFetch('k', loader);
    vi.setSystemTime(Date.now() + DEFAULT_TTL_MS - 1000);
    await getOrFetch('k', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 2000);
    await getOrFetch('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('gives "not found" (null) results a shorter lifetime', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    const loader = vi.fn(async () => null as string | null);
    const ttlFor = (v: string | null): number => (v === null ? NEGATIVE_TTL_MS : DEFAULT_TTL_MS);
    await getOrFetch('k', loader, ttlFor);
    vi.setSystemTime(Date.now() + NEGATIVE_TTL_MS / 2);
    await getOrFetch('k', loader, ttlFor);
    expect(loader).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + NEGATIVE_TTL_MS);
    await getOrFetch('k', loader, ttlFor);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    let resolve: (v: string) => void = () => undefined;
    const loader = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const a = getOrFetch('k', loader);
    const b = getOrFetch('k', loader);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    resolve('shared');
    expect(await a).toBe('shared');
    expect(await b).toBe('shared');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('never caches failures and allows a retry afterwards', async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    await expect(getOrFetch('k', loader)).rejects.toThrow('boom');
    expect(chromeMock.storage.local.__dump()['k']).toBeUndefined();
    expect(await getOrFetch('k', loader)).toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('prunes the 300 oldest entries once there are more than 3000', async () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({ key: `old:${i}`, savedAt: i + 1 }));
    const data: Record<string, unknown> = { cacheIndex: items };
    for (const item of items) data[item.key] = { v: item.key, savedAt: item.savedAt };
    await chromeMock.storage.local.set(data);

    await getOrFetch('fresh', async () => 'new');

    const dump = chromeMock.storage.local.__dump();
    const index = dump['cacheIndex'] as Array<{ key: string }>;
    expect(index).toHaveLength(2701);
    expect(dump['old:0']).toBeUndefined();
    expect(dump['old:299']).toBeUndefined();
    expect(dump['old:300']).toBeDefined();
    expect(dump['fresh']).toBeDefined();
  });
});

describe('clearCache', () => {
  it('removes every cached entry and the index, but leaves other data alone', async () => {
    await getOrFetch('a', async () => 1);
    await getOrFetch('b', async () => 2);
    await chromeMock.storage.local.set({ savedWords: [{ id: 'x' }], apiKey: 'sk-test' });
    await clearCache();
    const dump = chromeMock.storage.local.__dump();
    expect(dump['a']).toBeUndefined();
    expect(dump['b']).toBeUndefined();
    expect(dump['cacheIndex']).toBeUndefined();
    expect(dump['savedWords']).toEqual([{ id: 'x' }]);
    expect(dump['apiKey']).toBe('sk-test');
  });
});
