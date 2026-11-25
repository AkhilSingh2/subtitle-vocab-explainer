import { getApiKey } from '../shared/storage';

export type KeySource = 'user' | 'built-in';

/**
 * The demo key baked in at build time, if any. Lives in the service worker only (never imported by
 * content scripts) and is read lazily so tests can stub it.
 */
export function getEmbeddedKey(): string | null {
  const value: unknown = import.meta.env.VITE_EMBEDDED_API_KEY;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** The key to use: one the user entered in Settings wins over the built-in demo key. */
export async function resolveApiKey(): Promise<{ key: string; source: KeySource } | null> {
  const user = await getApiKey();
  if (user) return { key: user, source: 'user' };
  const embedded = getEmbeddedKey();
  return embedded ? { key: embedded, source: 'built-in' } : null;
}
