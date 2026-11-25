import type { SiteId } from '../shared/types';

export interface SiteAdapter {
  id: SiteId;
  label: string;
  matchesUrl(loc: Pick<Location, 'pathname'>): boolean;
  /** First match wins. */
  playerSelectors: string[];
  /** Container(s) that hold caption lines. First match wins. */
  captionRootSelectors: string[];
  /** Elements that represent one caption line (leaf text elements). */
  captionLineSelectors: string[];
  videoSelectors: string[];
}

export const youtubeAdapter: SiteAdapter = {
  id: 'youtube',
  label: 'YouTube',
  matchesUrl: (loc) => loc.pathname === '/watch',
  playerSelectors: ['#movie_player', '.html5-video-player'],
  captionRootSelectors: ['.ytp-caption-window-container'],
  captionLineSelectors: ['.ytp-caption-segment'],
  videoSelectors: ['video.html5-main-video', 'video'],
};

export const netflixAdapter: SiteAdapter = {
  id: 'netflix',
  label: 'Netflix',
  matchesUrl: (loc) => loc.pathname.startsWith('/watch/'),
  playerSelectors: ['.watch-video--player-view', '[data-uia="player"]', '.watch-video', '.NFPlayer'],
  captionRootSelectors: ['.player-timedtext', '[data-uia="player-timedtext"]'],
  captionLineSelectors: ['.player-timedtext-text-container span'],
  videoSelectors: ['video'],
};

export function getAdapter(hostname: string): SiteAdapter | null {
  if (hostname === 'www.youtube.com') return youtubeAdapter;
  if (hostname === 'www.netflix.com') return netflixAdapter;
  return null;
}

/** Returns the first element matched by the first selector that matches anything. */
export function queryFirst<T extends HTMLElement = HTMLElement>(
  selectors: readonly string[],
  root: ParentNode = document,
): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector);
    if (el) return el;
  }
  return null;
}

function isOurWrapper(el: Element): boolean {
  return el.classList.contains('sve-w') || el.classList.contains('sve-p');
}

/**
 * Leaf caption elements with text, in DOM order. Elements we created (`sve-w`, `sve-p`) are never
 * returned, and an element counts as a leaf if its only element children are our wrappers.
 */
export function getCaptionLines(adapter: SiteAdapter, root: ParentNode): HTMLElement[] {
  const selector = adapter.captionLineSelectors.join(', ');
  const lines: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (isOurWrapper(el) || el.closest('.sve-w, .sve-p')) continue;
    const hasForeignChild = Array.from(el.children).some((child) => !isOurWrapper(child));
    if (hasForeignChild) continue;
    if ((el.textContent ?? '').trim() === '') continue;
    lines.push(el);
  }
  return lines;
}
