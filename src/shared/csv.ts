import type { SavedWord } from './types';

const HEADER = ['word', 'definition', 'context', 'level', 'source', 'url', 'savedAt'];

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function siteLabel(site: SavedWord['site']): string {
  return site === 'youtube' ? 'YouTube' : 'Netflix';
}

/**
 * RFC 4180 CSV. Lines are joined with CRLF. The caller must prefix a UTF-8 BOM
 * (`\uFEFF`) when creating the Blob so Excel detects the encoding.
 */
export function savedWordsToCsv(words: readonly SavedWord[]): string {
  const lines = [HEADER.join(',')];
  for (const w of words) {
    lines.push(
      [
        quote(w.term),
        quote(w.definition),
        quote(w.context),
        quote(w.estimated ? `est. ${w.level}` : w.level),
        quote(`${siteLabel(w.site)} · ${w.pageTitle}`),
        quote(w.url),
        quote(new Date(w.savedAt).toISOString()),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}
