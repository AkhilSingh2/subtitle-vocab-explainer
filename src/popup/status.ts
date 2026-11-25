import type { ContentState } from '../shared/types';

export type StatusTone = 'grey' | 'amber' | 'green' | 'red';
export interface StatusLine {
  tone: StatusTone;
  text: string;
}

/**
 * The Home tab status line (docs/03 §7.1).
 * `state` is null when the active tab has no content script (not YouTube/Netflix, or not reloaded yet).
 */
export function describeStatus(state: ContentState | null, enabled: boolean): StatusLine {
  if (!enabled) return { tone: 'grey', text: 'Paused — turn on to use' };
  if (!state) return { tone: 'grey', text: 'Open a YouTube or Netflix video' };
  if (!state.isWatchPage) return { tone: 'grey', text: 'Open a video to start' };

  const site = state.site === 'youtube' ? 'YouTube' : 'Netflix';
  switch (state.captionsStatus) {
    case 'detected':
      return { tone: 'green', text: `Active on ${site} — captions detected` };
    case 'not-detected':
      return { tone: 'red', text: 'Captions not detected — the site may have changed' };
    default:
      return { tone: 'amber', text: 'Turn on captions/subtitles to start' };
  }
}
