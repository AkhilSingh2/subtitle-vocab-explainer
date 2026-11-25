import { beforeEach, vi } from 'vitest';

type StorageData = Record<string, unknown>;
type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string,
) => void;

const changeListeners = new Set<ChangeListener>();

function createArea(name: 'local' | 'sync') {
  let data: StorageData = {};
  const notify = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
    if (Object.keys(changes).length === 0) return;
    for (const listener of changeListeners) listener(changes, name);
  };
  return {
    async get(keys?: string | string[] | Record<string, unknown> | null): Promise<StorageData> {
      if (keys == null) return structuredClone(data);
      if (typeof keys === 'string') return keys in data ? { [keys]: structuredClone(data[keys]) } : {};
      if (Array.isArray(keys)) {
        const out: StorageData = {};
        for (const k of keys) if (k in data) out[k] = structuredClone(data[k]);
        return out;
      }
      const out: StorageData = {};
      for (const [k, fallback] of Object.entries(keys)) {
        out[k] = k in data ? structuredClone(data[k]) : fallback;
      }
      return out;
    },
    async set(items: StorageData): Promise<void> {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data[k], newValue: structuredClone(v) };
        data[k] = structuredClone(v);
      }
      notify(changes);
    },
    async remove(keys: string | string[]): Promise<void> {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const k of list) {
        if (k in data) {
          changes[k] = { oldValue: data[k] };
          delete data[k];
        }
      }
      notify(changes);
    },
    async clear(): Promise<void> {
      data = {};
    },
    /** test helper */
    __dump(): StorageData {
      return data;
    },
  };
}

export const chromeMock = {
  storage: {
    local: createArea('local'),
    sync: createArea('sync'),
    onChanged: {
      addListener: (cb: ChangeListener) => changeListeners.add(cb),
      removeListener: (cb: ChangeListener) => changeListeners.delete(cb),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
  tabs: {
    query: vi.fn(async (): Promise<Array<{ id?: number }>> => []),
    sendMessage: vi.fn(),
    create: vi.fn(),
  },
};

beforeEach(async () => {
  // A local .env.local may embed a demo key; tests must not depend on it.
  vi.stubEnv('VITE_EMBEDDED_API_KEY', '');
  await chromeMock.storage.local.clear();
  await chromeMock.storage.sync.clear();
  changeListeners.clear();
  vi.clearAllMocks();
  (globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
});
