export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lowercase, collapse whitespace, trim. Used for stable cache keys. */
export function normalizeContext(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
