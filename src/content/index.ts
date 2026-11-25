import {
  getSavedWords,
  getSettings,
  onSavedWordsChanged,
  onSettingsChanged,
} from '../shared/storage';
import {
  DEFAULT_SETTINGS,
  type ContentRequest,
  type ContentState,
  type SavedWord,
  type Settings,
} from '../shared/types';
import { savedKey } from './captionWrapper';
import { normalizeToken } from './idiomMatcher';
import { ContentSession } from './session';
import { ShadowTooltip, type TooltipHandlers } from './ShadowTooltip';
import { getAdapter, queryFirst } from './siteAdapters';

const URL_POLL_MS = 500;
const TOGGLE_TOAST_CLEANUP_MS = 1600;

const noop = (): void => undefined;
const NO_HANDLERS: TooltipHandlers = {
  onClose: noop,
  onToggleSave: noop,
  onRetry: noop,
  onNavigate: noop,
  onOpenSettings: noop,
  onDismissNudge: noop,
};

function savedKeys(words: readonly SavedWord[]): Set<string> {
  const keys = new Set<string>();
  for (const w of words) {
    if (w.term.includes(' ')) continue; // only single words are underlined in captions
    keys.add(normalizeToken(w.term));
    keys.add(savedKey(w.term));
  }
  return keys;
}

async function main(): Promise<void> {
  const adapter = getAdapter(location.hostname);
  if (!adapter) return;

  let settings: Settings = DEFAULT_SETTINGS;
  let saved: ReadonlySet<string> = new Set();
  let session: ContentSession | null = null;
  let lastHref = location.href;

  const sync = (): void => {
    const shouldRun = settings.enabled && adapter.matchesUrl(location);
    if (shouldRun && !session) {
      session = new ContentSession(adapter, () => settings);
      session.start(saved);
    } else if (!shouldRun && session) {
      session.stop();
      session = null;
    }
  };

  /** "Vocab Explainer on/off" toast. Uses its own short-lived tooltip because the session may not exist. */
  const showToggleToast = (on: boolean): void => {
    const tooltip = new ShadowTooltip(NO_HANDLERS);
    const rect = queryFirst(adapter.playerSelectors)?.getBoundingClientRect();
    tooltip.toast(
      on ? 'Vocab Explainer on' : 'Vocab Explainer off',
      rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
    );
    setTimeout(() => tooltip.destroy(), TOGGLE_TOAST_CLEANUP_MS);
  };

  const onNavigate = (): void => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    session?.resetContext();
    sync();
  };

  [settings, saved] = await Promise.all([getSettings(), getSavedWords().then(savedKeys)]);
  sync();

  onSettingsChanged((next) => {
    const enabledChanged = next.enabled !== settings.enabled;
    settings = next;
    sync();
    if (enabledChanged && adapter.matchesUrl(location)) showToggleToast(next.enabled);
  });
  onSavedWordsChanged((words) => {
    saved = savedKeys(words);
    session?.setSaved(saved);
  });

  document.addEventListener('yt-navigate-finish', onNavigate);
  setInterval(onNavigate, URL_POLL_MS);

  chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
    if (message.type !== 'GET_STATE') return false;
    const state: ContentState = {
      site: adapter.id,
      isWatchPage: adapter.matchesUrl(location),
      captionsStatus: session?.getState().captionsStatus ?? 'waiting',
      enabled: settings.enabled,
    };
    sendResponse(state);
    return false;
  });
}

void main();
