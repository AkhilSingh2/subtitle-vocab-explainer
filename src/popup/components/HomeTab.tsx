import type { ReactNode } from 'react';
import type { ContentState, SavedWord, Settings, TargetLevel } from '../../shared/types';
import { describeStatus, type StatusTone } from '../status';
import { timeAgo } from '../time';
import { LevelBadge, Row, Segmented, Switch, focusRing } from './ui';

const LEVELS: readonly TargetLevel[] = ['B1', 'B2', 'C1', 'C2'];

const dotClass: Record<StatusTone, string> = {
  grey: 'bg-gray-400',
  amber: 'bg-amber-400',
  green: 'bg-success',
  red: 'bg-danger',
};

export type TabId = 'home' | 'words' | 'settings';

export function HomeTab(props: {
  state: ContentState | null;
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  hasKey: boolean;
  words: readonly SavedWord[];
  goTo: (tab: TabId) => void;
}): ReactNode {
  const { state, settings, update, hasKey, words, goTo } = props;
  const status = describeStatus(state, settings.enabled);
  const recent = words.slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center gap-2 rounded-lg border border-light-border px-3 py-2 text-sm dark:border-white/10"
        role="status"
      >
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${dotClass[status.tone]}`} aria-hidden="true" />
        <span>{status.text}</span>
      </div>

      <div className="flex flex-col gap-2">
        <Row label="Your level">
          <Segmented
            label="Your level"
            value={settings.level}
            options={LEVELS}
            onChange={(level) => update({ level })}
          />
        </Row>
        <Row label="Mode">
          {hasKey ? (
            <span className="text-sm font-semibold">AI ✓ (Claude)</span>
          ) : (
            <span className="text-sm">
              Free ·{' '}
              <button
                type="button"
                onClick={() => goTo('settings')}
                className={`font-semibold text-light-accent underline-offset-2 hover:underline dark:text-accent ${focusRing}`}
              >
                add AI key →
              </button>
            </span>
          )}
        </Row>
        <Row label="Smart pause">
          <Switch
            label="Smart pause"
            checked={settings.smartPause}
            onChange={(smartPause) => update({ smartPause })}
          />
        </Row>
      </div>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-1 text-xs font-bold uppercase tracking-wider text-light-secondary dark:text-dark-secondary">
          Recently saved
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-light-secondary dark:text-dark-secondary">
            Click any caption word to start your list.
          </p>
        ) : (
          <ul className="flex flex-col">
            {recent.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{w.term}</span>
                  <span className="text-light-secondary dark:text-dark-secondary">
                    {' '}
                    · {w.partOfSpeech || 'word'}
                  </span>{' '}
                  <LevelBadge level={w.level} estimated={w.estimated} />
                </span>
                <span className="flex-none text-xs text-light-secondary dark:text-dark-secondary">
                  {timeAgo(w.savedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {words.length > 0 && (
          <button
            type="button"
            onClick={() => goTo('words')}
            className={`mt-1 text-sm font-semibold text-light-accent dark:text-accent ${focusRing}`}
          >
            see all →
          </button>
        )}
      </section>
    </div>
  );
}
