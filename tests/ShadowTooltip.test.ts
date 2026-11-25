import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialModel, type CardModel } from '../src/content/cardContent';
import { ShadowTooltip, type TooltipHandlers } from '../src/content/ShadowTooltip';
import type { AiExplanation, DictResult } from '../src/shared/types';

const rect = () => ({ top: 400, left: 300, width: 60, height: 24 });
const noPlayer = () => null;

const dict: DictResult = {
  word: 'reluctant',
  phonetic: '/rɪˈlʌktənt/',
  meanings: [
    { partOfSpeech: 'adjective', definitions: [{ definition: 'Not wanting to do something.', example: 'She was reluctant to leave.' }] },
  ],
};
const ai: AiExplanation = {
  lemma: 'reluctant',
  ipa: 'rɪˈlʌktənt',
  partOfSpeech: 'adjective',
  isIdiom: false,
  register: 'neutral',
  cefr: 'C1',
  shortDefinition: 'Not wanting to do something.',
  inContext: 'He did not want to leave the party.',
  example: 'I was reluctant to go.',
  simpler: 'unwilling',
};

let handlers: { [K in keyof TooltipHandlers]: ReturnType<typeof vi.fn> };
let tooltip: ShadowTooltip;

const root = (): ShadowRoot => {
  const host = document.getElementById('sve-host');
  if (!host?.shadowRoot) throw new Error('shadow root not found');
  return host.shadowRoot;
};
const text = (): string => root().textContent ?? '';
const button = (label: string): HTMLButtonElement => {
  const el = Array.from(root().querySelectorAll('button')).find(
    (b) => b.textContent?.includes(label) || b.getAttribute('aria-label') === label,
  );
  if (!el) throw new Error(`button not found: ${label}`);
  return el;
};
const freeModel = (patch: Partial<CardModel> = {}): CardModel => ({
  ...createInitialModel('reluctant', false, false),
  dictionary: { status: 'ready', data: dict },
  level: { level: 'B2', estimated: true },
  hasKey: false,
  ...patch,
});
const key = (k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  document.body.innerHTML = '';
  handlers = {
    onClose: vi.fn(),
    onToggleSave: vi.fn(),
    onRetry: vi.fn(),
    onNavigate: vi.fn(),
    onOpenSettings: vi.fn(),
    onDismissNudge: vi.fn(),
  };
  tooltip = new ShadowTooltip(handlers, { shadowMode: 'open' });
});

afterEach(() => {
  tooltip.destroy();
});

describe('isolation and safety', () => {
  it('uses a closed shadow root by default (host page cannot reach inside)', () => {
    tooltip.destroy();
    document.body.innerHTML = '';
    const closed = new ShadowTooltip(handlers);
    const host = document.getElementById('sve-host');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).toBeNull();
    closed.destroy();
    expect(document.getElementById('sve-host')).toBeNull();
  });

  it('renders untrusted text as text, never as HTML', () => {
    tooltip.show(
      freeModel({
        term: '<img src=x onerror="window.__pwned=1">',
        dictionary: { status: 'ready', data: { ...dict, meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: '<b>bold</b>' }] }] } },
      }),
      rect,
      noPlayer,
    );
    expect(root().querySelector('img')).toBeNull();
    expect(root().querySelector('b')).toBeNull();
    expect(text()).toContain('<img src=x onerror="window.__pwned=1">');
    expect(text()).toContain('<b>bold</b>');
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('moves into the fullscreen element and back', () => {
    const player = document.createElement('div');
    document.body.append(player);
    Object.defineProperty(document, 'fullscreenElement', { value: player, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(document.getElementById('sve-host')?.parentElement).toBe(player);
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(document.getElementById('sve-host')?.parentElement).toBe(document.body);
  });
});

describe('card states (docs/03 §4.4)', () => {
  it('loading: shows the term and skeleton bars, but no badge or audio button', () => {
    tooltip.show(createInitialModel('reluctant', false, false), rect, noPlayer);
    expect(text()).toContain('reluctant');
    expect(root().querySelectorAll('.bar').length).toBe(3);
    expect(root().querySelector('.badge')).toBeNull();
    expect(root().querySelector('[aria-label="Pronounce"]')).toBeNull();
    expect(root().querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Definition of reluctant');
  });

  it('free mode: definition, example, estimated badge, ipa and the AI nudge', () => {
    tooltip.show(freeModel(), rect, noPlayer);
    expect(text()).toContain('Not wanting to do something.');
    expect(text()).toContain('“She was reluctant to leave.”');
    expect(root().querySelector('.badge')?.textContent).toBe('est. B2');
    expect(text()).toContain('/rɪˈlʌktənt/');
    expect(text()).toContain('adjective');
    expect(text()).toContain('Add an AI key in Settings for in-context meaning →');
    expect(text()).not.toContain('In this scene');
  });

  it('free mode: nudge stays hidden once dismissed and can be dismissed', () => {
    tooltip.show(freeModel({ nudgeDismissed: true }), rect, noPlayer);
    expect(text()).not.toContain('Add an AI key');
    tooltip.update(freeModel({ nudgeDismissed: false }));
    button('Dismiss').click();
    expect(handlers.onDismissNudge).toHaveBeenCalledTimes(1);
    button('Add an AI key in Settings for in-context meaning →').click();
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('AI loading: dictionary shown with a "Reading the scene…" skeleton', () => {
    tooltip.show(freeModel({ hasKey: true, ai: { status: 'loading' } }), rect, noPlayer);
    expect(text()).toContain('In this scene');
    expect(text()).toContain('Reading the scene…');
    expect(text()).toContain('Not wanting to do something.');
    expect(text()).not.toContain('Add an AI key');
  });

  it('AI loaded: in-context text, example, simpler and a plain C1 badge', () => {
    tooltip.show(freeModel({ hasKey: true, ai: { status: 'ready', data: ai } }), rect, noPlayer);
    expect(text()).toContain('He did not want to leave the party.');
    expect(text()).toContain('“I was reluctant to go.”');
    expect(text()).toContain('Simpler: unwilling');
    expect(root().querySelector('.badge')?.textContent).toBe('C1');
  });

  it('progressively updates from loading to loaded', () => {
    tooltip.show(createInitialModel('reluctant', false, false), rect, noPlayer);
    expect(root().querySelectorAll('.bar').length).toBe(3);
    tooltip.update(freeModel());
    expect(root().querySelectorAll('.bar').length).toBe(0);
    expect(text()).toContain('Not wanting to do something.');
  });

  it('not found: copy differs between free and AI mode', () => {
    tooltip.show(freeModel({ term: 'xyzzy', dictionary: { status: 'ready', data: null } }), rect, noPlayer);
    expect(text()).toContain('No dictionary entry for ‘xyzzy’.');
    expect(text()).toContain('It may be a name or slang.');
    tooltip.update(
      freeModel({ term: 'xyzzy', dictionary: { status: 'ready', data: null }, hasKey: true, ai: { status: 'loading' } }),
    );
    expect(text()).toContain('No dictionary entry for ‘xyzzy’.');
    expect(text()).not.toContain('It may be a name or slang.');
  });

  it('hides the not-found line once the AI supplies a definition', () => {
    tooltip.show(
      freeModel({ dictionary: { status: 'ready', data: null }, hasKey: true, ai: { status: 'ready', data: ai } }),
      rect,
      noPlayer,
    );
    expect(text()).not.toContain('No dictionary entry');
    expect(text()).toContain('Not wanting to do something.');
  });

  it('dictionary error shows copy and a working Retry', () => {
    tooltip.show(
      freeModel({ dictionary: { status: 'error', error: { code: 'NETWORK', message: 'x' } } }),
      rect,
      noPlayer,
    );
    expect(text()).toContain('Couldn’t reach the dictionary.');
    button('Retry').click();
    expect(handlers.onRetry).toHaveBeenCalledWith('dictionary');
  });

  it('AI errors: invalid key offers Settings; rate limit offers Retry; dictionary stays visible', () => {
    const withError = (code: 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'UNKNOWN'): CardModel =>
      freeModel({ hasKey: true, ai: { status: 'error', error: { code, message: '' } } });

    tooltip.show(withError('INVALID_KEY'), rect, noPlayer);
    expect(text()).toContain('Your API key was rejected. Check it in Settings.');
    expect(text()).toContain('Not wanting to do something.');
    button('Open Settings').click();
    expect(handlers.onOpenSettings).toHaveBeenCalled();

    tooltip.update(withError('RATE_LIMIT'));
    expect(text()).toContain('Too many requests — try again in a moment.');
    button('Retry').click();
    expect(handlers.onRetry).toHaveBeenCalledWith('ai');

    tooltip.update(withError('NETWORK'));
    expect(text()).toContain('Couldn’t reach the AI service.');
    tooltip.update(withError('UNKNOWN'));
    expect(text()).toContain('Couldn’t explain this one.');
  });

  it('save button toggles its label and calls the handler', () => {
    tooltip.show(freeModel(), rect, noPlayer);
    expect(button('Save word').textContent).toBe('☆ Save word');
    button('Save word').click();
    expect(handlers.onToggleSave).toHaveBeenCalledTimes(1);
    tooltip.update(freeModel({ saved: true }));
    expect(button('Remove saved word').textContent).toBe('✓ Saved');
  });

  it('disables Save until there is a definition', () => {
    tooltip.show(createInitialModel('reluctant', false, false), rect, noPlayer);
    expect(button('Save word').disabled).toBe(true);
    tooltip.update(freeModel());
    expect(button('Save word').disabled).toBe(false);
  });

  it('idiom card shows the idiom tag and B2+ badge', () => {
    tooltip.show(
      freeModel({
        term: 'break the ice',
        isPhrase: true,
        dictionary: {
          status: 'ready',
          data: { word: 'break the ice', meanings: [{ partOfSpeech: 'idiom', definitions: [{ definition: 'Make people relax.' }] }] },
        },
      }),
      rect,
      noPlayer,
    );
    expect(root().querySelector('.idiom-tag')?.textContent).toBe('idiom');
    expect(root().querySelector('.badge')?.textContent).toBe('B2+');
  });
});

describe('keyboard (docs/03 §6)', () => {
  it('Esc, S, arrows call handlers and swallow the event only while a card is open', () => {
    tooltip.show(freeModel(), rect, noPlayer);

    expect(key('Escape').defaultPrevented).toBe(true);
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

    expect(key('s').defaultPrevented).toBe(true);
    expect(handlers.onToggleSave).toHaveBeenCalledTimes(1);

    key('ArrowLeft');
    key('ArrowRight');
    expect(handlers.onNavigate).toHaveBeenNthCalledWith(1, -1);
    expect(handlers.onNavigate).toHaveBeenNthCalledWith(2, 1);
  });

  it('does not intercept keys when no card is open', () => {
    expect(key('ArrowLeft').defaultPrevented).toBe(false);
    expect(key('s').defaultPrevented).toBe(false);
    expect(handlers.onNavigate).not.toHaveBeenCalled();
  });

  it('stops intercepting after the card closes', () => {
    tooltip.show(freeModel(), rect, noPlayer);
    tooltip.close();
    expect(key('ArrowLeft').defaultPrevented).toBe(false);
  });

  it('ignores shortcuts with modifier keys and while typing in a field', () => {
    tooltip.show(freeModel(), rect, noPlayer);
    expect(key('s', { ctrlKey: true }).defaultPrevented).toBe(false);
    const input = document.createElement('input');
    document.body.append(input);
    const event = new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(handlers.onToggleSave).not.toHaveBeenCalled();
  });

  it('P pronounces using speech synthesis when there is no audio file', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
        lang = '';
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
      },
    );
    tooltip.show(freeModel(), rect, noPlayer);
    key('p');
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as { text: string; lang: string; rate: number };
    expect(utterance).toMatchObject({ text: 'reluctant', lang: 'en-US', rate: 0.9 });
    vi.unstubAllGlobals();
  });
});

describe('closing', () => {
  it('closes on a pointerdown outside the card but not on a caption word', () => {
    const word = document.createElement('span');
    word.className = 'sve-w';
    const other = document.createElement('div');
    document.body.append(word, other);
    tooltip.show(freeModel(), rect, noPlayer);

    word.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(handlers.onClose).not.toHaveBeenCalled();
    other.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('reports isOpen correctly', () => {
    expect(tooltip.isOpen()).toBe(false);
    tooltip.show(freeModel(), rect, noPlayer);
    expect(tooltip.isOpen()).toBe(true);
    tooltip.close();
    expect(tooltip.isOpen()).toBe(false);
  });
});

describe('toast', () => {
  it('shows text and hides after about 1.2 seconds', () => {
    vi.useFakeTimers();
    tooltip.toast('Paused for lookup', { top: 0, left: 0, width: 800, height: 450 });
    const toast = root().querySelector('.toast');
    expect(toast?.textContent).toBe('Paused for lookup');
    expect(toast?.classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(1250);
    expect(toast?.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });
});
