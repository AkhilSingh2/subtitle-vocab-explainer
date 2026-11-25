import { IDIOMS } from '../shared/idioms';
import type { ContentState } from '../shared/types';
import { CaptionHistory } from './captionHistory';
import { applySavedClasses, countWords, isLineProcessed, wrapLine } from './captionWrapper';
import { extractWordTokens, findPhrasesInSentence, type PhraseMatch } from './idiomMatcher';
import type { Rect } from './placement';
import { PAGE_STYLE_ID, buildPageCss } from './pageStyles';
import { getCaptionLines, queryFirst, type SiteAdapter } from './siteAdapters';

export interface TermActivation {
  /** Text as shown in the caption (original case, trimmed of edge punctuation). */
  term: string;
  isPhrase: boolean;
  /** Meaning from the bundled idiom list when the phrase is a known idiom. */
  phraseMeaning?: string;
  anchor: HTMLElement;
  /** Fixed anchor rectangle (used for drag-selections, whose range disappears after selection). */
  anchorRect?: Rect;
  /** Previous + current caption sentence. */
  context: string;
}

const PLAYER_POLL_MS = 500;
const NOT_DETECTED_AFTER_MS = 30_000;
const MIN_SELECTION_WORDS = 1;
const MAX_SELECTION_WORDS = 6;
const MAX_SELECTION_CHARS = 60;

/** Pointer/mouse events on caption words that the host site must not see (it would toggle play/pause). */
const SWALLOWED_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick'] as const;

function cleanDisplay(text: string): string {
  return text.replace(/^['’-]+|['’-]+$/g, '').trim();
}

export class CaptionController {
  private player: HTMLElement | null = null;
  private video: HTMLVideoElement | null = null;
  private observer: MutationObserver | null = null;
  private frame = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private notDetectedTimer: ReturnType<typeof setTimeout> | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private saved: ReadonlySet<string> = new Set();
  private readonly history = new CaptionHistory();
  private status: ContentState['captionsStatus'] = 'waiting';
  private rootSeen = false;
  private running = false;

  private suppressClicksUntil = 0;

  constructor(
    private readonly adapter: SiteAdapter,
    private readonly onActivate: (activation: TermActivation) => void,
    private readonly onCaptionChange?: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.injectStyles();
    document.addEventListener('click', this.onClick, true);
    for (const type of SWALLOWED_EVENTS) document.addEventListener(type, this.onSwallow, true);

    // Single-page sites (Netflix especially) create, replace and destroy the player while we run, so
    // keep checking instead of attaching once and giving up.
    this.ensureAttached();
    this.pollTimer = setInterval(() => this.ensureAttached(), PLAYER_POLL_MS);
  }

  /** Attaches to the player if none is attached, or re-attaches if the site replaced it. */
  private ensureAttached(): void {
    if (!this.running) return;
    if (this.player?.isConnected && (this.video === null || this.video.isConnected)) return;
    if (this.player) this.detach();
    const player = queryFirst(this.adapter.playerSelectors) ?? this.playerFromVideo();
    if (player) this.attach(player);
  }

  /** Fallback when the site's player selectors stop matching: use the page's main <video>. */
  private playerFromVideo(): HTMLElement | null {
    const video = queryFirst<HTMLVideoElement>(this.adapter.videoSelectors);
    if (!video) return null;
    // Captions are siblings of the video, not children, so observe a few levels up.
    let el: HTMLElement = video;
    for (let i = 0; i < 3 && el.parentElement && el.parentElement !== document.body; i++) {
      el = el.parentElement;
    }
    return el;
  }

  private detach(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.video?.removeEventListener('playing', this.onPlaying);
    this.video = null;
    this.player = null;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clearPoll();
    if (this.notDetectedTimer !== null) clearTimeout(this.notDetectedTimer);
    this.notDetectedTimer = null;
    this.observer?.disconnect();
    this.observer = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.video?.removeEventListener('playing', this.onPlaying);
    this.video = null;
    this.player = null;
    document.removeEventListener('click', this.onClick, true);
    for (const type of SWALLOWED_EVENTS) document.removeEventListener(type, this.onSwallow, true);
    this.styleEl?.remove();
    this.styleEl = null;
    this.history.clear();
    this.status = 'waiting';
    this.rootSeen = false;
  }

  /** Call when the user navigates to another video without the player being recreated. */
  resetContext(): void {
    this.history.clear();
    this.status = 'waiting';
    this.rootSeen = false;
  }

  setSaved(saved: ReadonlySet<string>): void {
    this.saved = saved;
    applySavedClasses(document, saved);
  }

  getStatus(): ContentState['captionsStatus'] {
    return this.status;
  }

  getContext(): string {
    return this.history.getContext();
  }

  getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  getPlayer(): HTMLElement | null {
    return this.player;
  }

  private clearPoll(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private injectStyles(): void {
    if (document.getElementById(PAGE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = PAGE_STYLE_ID;
    style.textContent = buildPageCss(this.adapter);
    document.head.append(style);
    this.styleEl = style;
  }

  private attach(player: HTMLElement): void {
    this.player = player;
    this.video =
      queryFirst<HTMLVideoElement>(this.adapter.videoSelectors, player) ??
      queryFirst<HTMLVideoElement>(this.adapter.videoSelectors);
    this.video?.addEventListener('playing', this.onPlaying);
    this.observer = new MutationObserver(() => this.schedule());
    this.observe();
    this.schedule();
  }

  private observe(): void {
    if (!this.observer || !this.player) return;
    this.observer.observe(this.player, { childList: true, subtree: true, characterData: true });
  }

  private readonly onPlaying = (): void => {
    if (this.rootSeen || this.notDetectedTimer !== null) return;
    this.notDetectedTimer = setTimeout(() => {
      this.notDetectedTimer = null;
      if (!this.rootSeen && this.status !== 'detected') this.status = 'not-detected';
    }, NOT_DETECTED_AFTER_MS);
  };

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.processCaptions();
    });
  }

  private processCaptions(): void {
    if (!this.running || !this.player) return;
    const root = queryFirst(this.adapter.captionRootSelectors, this.player);
    if (!root) return;
    this.rootSeen = true;
    if (this.notDetectedTimer !== null) {
      clearTimeout(this.notDetectedTimer);
      this.notDetectedTimer = null;
    }
    if (this.status === 'not-detected') this.status = 'waiting';

    const lines = getCaptionLines(this.adapter, root);
    if (lines.length === 0) return;

    const texts = lines.map((line) => line.textContent ?? '');
    const sentence = texts.join(' ');
    if (this.history.push(sentence)) this.onCaptionChange?.();

    if (lines.every(isLineProcessed)) return;

    const phrases = findPhrasesInSentence(sentence, IDIOMS).filter((p) => p.endToken > p.startToken);

    // Pause observation while we mutate the DOM so we don't react to our own changes.
    this.observer?.disconnect();
    try {
      let offset = 0;
      lines.forEach((line, index) => {
        const count = countWords(texts[index] ?? '');
        const relative: PhraseMatch[] = phrases
          .filter((p) => p.startToken >= offset && p.endToken < offset + count)
          .map((p) => ({ ...p, startToken: p.startToken - offset, endToken: p.endToken - offset }));
        if (wrapLine(line, { phrases: relative, saved: this.saved })) this.status = 'detected';
        offset += count;
      });
    } finally {
      this.observe();
    }
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const wordEl = target.closest<HTMLElement>('.sve-w');
    if (!wordEl) return;

    // The click that ends a drag-selection must not also open a single-word card.
    if (performance.now() < this.suppressClicksUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // A drag-selection ends with a click on the same element; the selection handler owns that case.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim() !== '') return;

    event.preventDefault();
    event.stopPropagation();

    const activation = this.activationFor(wordEl.closest<HTMLElement>('.sve-p') ?? wordEl);
    if (activation) this.onActivate(activation);
  };

  /** Ignore word clicks for a short while (the click that follows a drag-selection). */
  suppressClicks(ms: number): void {
    this.suppressClicksUntil = performance.now() + ms;
  }

  /** True if the element is part of a caption line or one of our word/phrase wrappers. */
  isCaptionTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return target.closest(`${this.adapter.captionLineSelectors.join(', ')}, .sve-w, .sve-p`) !== null;
  }

  /**
   * The activation for a drag-selection of 1–6 words inside a single caption line, or null.
   * A one-word selection behaves like a click on that word.
   */
  activationForSelection(selection: Selection): TermActivation | null {
    const anchorLine = this.lineOf(selection.anchorNode);
    if (!anchorLine || anchorLine !== this.lineOf(selection.focusNode)) return null;

    const text = selection.toString().replace(/\s+/g, ' ').trim();
    if (text === '' || text.length > MAX_SELECTION_CHARS) return null;
    const words = extractWordTokens(text);
    if (words.length < MIN_SELECTION_WORDS || words.length > MAX_SELECTION_WORDS) return null;

    if (words.length === 1) {
      const node = selection.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      const wordEl = el?.closest<HTMLElement>('.sve-w');
      return wordEl ? this.activationFor(wordEl.closest<HTMLElement>('.sve-p') ?? wordEl) : null;
    }

    const known = findPhrasesInSentence(text, IDIOMS).find(
      (m) => m.startToken === 0 && m.endToken === words.length - 1,
    );
    const r = selection.getRangeAt(0).getBoundingClientRect();
    return {
      term: cleanDisplay(text),
      isPhrase: true,
      ...(known ? { phraseMeaning: known.meaning } : {}),
      anchor: anchorLine,
      anchorRect: { top: r.top, left: r.left, width: r.width, height: r.height },
      context: this.history.getContext(),
    };
  }

  private lineOf(node: Node | null): HTMLElement | null {
    const el = node instanceof Element ? node : (node?.parentElement ?? null);
    return el?.closest<HTMLElement>('[data-sve-done]') ?? null;
  }

  /** Builds the activation for a `.sve-w` or `.sve-p` element. */
  activationFor(anchor: HTMLElement): TermActivation | null {
    const isPhrase = anchor.classList.contains('sve-p');
    const term = cleanDisplay(anchor.textContent ?? '');
    if (term === '') return null;
    const key = isPhrase ? anchor.dataset['svePhrase'] : undefined;
    const phraseMeaning = key !== undefined ? IDIOMS[key] : undefined;
    return {
      term,
      isPhrase,
      ...(phraseMeaning !== undefined ? { phraseMeaning } : {}),
      anchor,
      context: this.history.getContext(),
    };
  }

  /** The previous/next word (or idiom group) in the same caption line, wrapping around. */
  getAdjacentActivation(anchor: HTMLElement, direction: -1 | 1): TermActivation | null {
    const line = anchor.closest<HTMLElement>('[data-sve-done]');
    if (!line) return null;
    const items = Array.from(line.querySelectorAll<HTMLElement>(':scope > .sve-w, :scope > .sve-p'));
    if (items.length === 0) return null;
    const index = items.indexOf(anchor);
    const next = items[index === -1 ? 0 : (index + direction + items.length) % items.length];
    return next ? this.activationFor(next) : null;
  }

  private readonly onSwallow = (event: Event): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('.sve-w')) event.stopPropagation();
  };
}
