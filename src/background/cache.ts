const INDEX_KEY = 'cacheIndex';
const MAX_ENTRIES = 3000;
const PRUNE_COUNT = 300;

export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000;

interface Entry<T> {
  v: T;
  savedAt: number;
}
interface IndexItem {
  key: string;
  savedAt: number;
}

const inflight = new Map<string, Promise<unknown>>();

async function readIndex(): Promise<IndexItem[]> {
  const stored = await chrome.storage.local.get(INDEX_KEY);
  const index = stored[INDEX_KEY];
  return Array.isArray(index) ? (index as IndexItem[]) : [];
}

async function writeEntry<T>(key: string, value: T): Promise<void> {
  const savedAt = Date.now();
  const entry: Entry<T> = { v: value, savedAt };
  let index = (await readIndex()).filter((item) => item.key !== key);
  index.push({ key, savedAt });

  let toRemove: string[] = [];
  if (index.length > MAX_ENTRIES) {
    const sorted = [...index].sort((a, b) => a.savedAt - b.savedAt);
    toRemove = sorted.slice(0, PRUNE_COUNT).map((item) => item.key);
    const removed = new Set(toRemove);
    index = index.filter((item) => !removed.has(item.key));
  }

  await chrome.storage.local.set({ [key]: entry, [INDEX_KEY]: index });
  if (toRemove.length > 0) await chrome.storage.local.remove(toRemove);
}

/**
 * Returns the cached value for `key` if fresh, otherwise runs `loader`, caches and returns its result.
 * Concurrent calls with the same key share one in-flight promise. Failures are never cached.
 * `ttlFor` lets callers give some results (e.g. "not found") a shorter lifetime.
 */
export async function getOrFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlFor: (value: T) => number = () => DEFAULT_TTL_MS,
): Promise<T> {
  const stored = await chrome.storage.local.get(key);
  const hit = stored[key] as Entry<T> | undefined;
  if (hit && typeof hit.savedAt === 'number') {
    if (Date.now() - hit.savedAt < ttlFor(hit.v)) return hit.v;
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    const value = await loader();
    await writeEntry(key, value);
    return value;
  })();
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export async function clearCache(): Promise<void> {
  const index = await readIndex();
  await chrome.storage.local.remove([...index.map((item) => item.key), INDEX_KEY]);
}
