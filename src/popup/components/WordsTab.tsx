import { useMemo, useState, type ReactNode } from 'react';
import { savedWordsToCsv } from '../../shared/csv';
import { removeWord } from '../../shared/storage';
import type { SavedWord } from '../../shared/types';
import { csvFileName, timeAgo } from '../time';
import { LevelBadge, buttonClass, focusRing } from './ui';

export function filterWords(words: readonly SavedWord[], query: string): SavedWord[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...words];
  return words.filter(
    (w) =>
      w.term.toLowerCase().includes(q) ||
      w.definition.toLowerCase().includes(q) ||
      w.context.toLowerCase().includes(q),
  );
}

const BOM = '\uFEFF';

function exportCsv(words: readonly SavedWord[]): void {
  // UTF-8 BOM so Excel detects the encoding.
  const blob = new Blob([BOM + savedWordsToCsv(words)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WordsTab(props: { words: readonly SavedWord[] }): ReactNode {
  const { words } = props;
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const shown = useMemo(() => filterWords(words, query), [words, query]);

  if (words.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-light-secondary dark:text-dark-secondary">
        Click any caption word to start your list.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search saved words"
        aria-label="Search saved words"
        className={`w-full rounded-lg border border-light-border bg-transparent px-3 py-1.5 text-sm dark:border-white/15 ${focusRing}`}
      />

      <ul className="-mx-1 flex-1 overflow-y-auto">
        {shown.map((w) => {
          const open = expanded === w.id;
          return (
            <li key={w.id} className="border-b border-light-border last:border-0 dark:border-white/10">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : w.id)}
                className={`flex w-full items-center justify-between gap-2 px-1 py-2 text-left text-sm ${focusRing}`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{w.term}</span>
                  <span className="text-light-secondary dark:text-dark-secondary"> · {w.partOfSpeech || 'word'}</span>{' '}
                  <LevelBadge level={w.level} estimated={w.estimated} />
                </span>
                <span className="flex-none text-xs text-light-secondary dark:text-dark-secondary">
                  {timeAgo(w.savedAt)}
                </span>
              </button>
              {open && (
                <div className="flex flex-col gap-1.5 px-1 pb-3 text-sm">
                  <p>{w.definition}</p>
                  {w.context && (
                    <p className="italic text-light-secondary dark:text-dark-secondary">“{w.context}”</p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`min-w-0 truncate text-light-accent underline-offset-2 hover:underline dark:text-accent ${focusRing}`}
                    >
                      {w.site === 'youtube' ? 'YouTube' : 'Netflix'} · {w.pageTitle || 'Untitled'}
                    </a>
                    <button
                      type="button"
                      aria-label={`Delete ${w.term}`}
                      onClick={() => void removeWord(w.id)}
                      className={`flex-none rounded px-1.5 py-0.5 text-danger hover:bg-danger/10 ${focusRing}`}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="py-6 text-center text-sm text-light-secondary dark:text-dark-secondary">
            No saved words match “{query}”.
          </li>
        )}
      </ul>

      <button type="button" className={buttonClass} onClick={() => exportCsv(words)}>
        Export CSV
      </button>
    </div>
  );
}
