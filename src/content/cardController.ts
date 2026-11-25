import { sha256Hex } from '../shared/hash';
import { getSavedWords, setSettings } from '../shared/storage';
import type {
  AiExplanation,
  BgRequest,
  Cefr,
  LookupData,
  Result,
  SavedWord,
  Settings,
  SiteId,
} from '../shared/types';
import { createInitialModel, deriveCardContent, type CardModel } from './cardContent';
import type { CaptionController, TermActivation } from './captionController';
import type { Rect } from './placement';
import { ShadowTooltip } from './ShadowTooltip';

export interface CardControllerDeps {
  captions: CaptionController;
  site: SiteId;
  getSettings: () => Settings;
  /** Hooks for smart pause (milestone M5). */
  onOpen?: () => void;
  onClose?: () => void;
}

const SETTINGS_HINT = 'Click the extension icon, then open Settings.';

/** Sends a message to the background worker. Network-style failures become a Result error. */
async function send<T>(request: BgRequest): Promise<Result<T>> {
  try {
    const response = (await chrome.runtime.sendMessage(request)) as Result<T> | undefined;
    if (response) return response;
    return { ok: false, error: { code: 'UNKNOWN', message: 'No response from the extension.' } };
  } catch {
    return { ok: false, error: { code: 'UNKNOWN', message: 'Extension is not available.' } };
  }
}

function pageTitle(): string {
  return document.title.replace(/^\(\d+\)\s*/, '').replace(/\s+-\s+YouTube$/, '').trim();
}

/**
 * Runs one card "session": opens the tooltip, fires LOOKUP / HAS_KEY / EXPLAIN, ignores answers that
 * arrive after the card was closed or re-targeted, and handles save / retry / navigation.
 */
export class CardController {
  private readonly tooltip: ShadowTooltip;
  private activation: TermActivation | null = null;
  private model: CardModel | null = null;
  private requestId = 0;
  private pointerInside = false;
  private lastAnchorRect: Rect = { top: 0, left: 0, width: 0, height: 0 };
  /** Learned from the first HAS_KEY / EXPLAIN answer; null until then. Skips useless prefetches. */
  private knownHasKey: boolean | null = null;
  private lastPrefetch = '';

  constructor(private readonly deps: CardControllerDeps) {
    this.tooltip = new ShadowTooltip({
      onClose: () => this.close(),
      onToggleSave: () => void this.toggleSave(),
      onRetry: (kind) => this.retry(kind),
      onNavigate: (direction) => this.navigate(direction),
      onOpenSettings: () => void this.openSettings(),
      onDismissNudge: () => void this.dismissNudge(),
    });
  }

  isOpen(): boolean {
    return this.tooltip.isOpen();
  }

  /** True if the card is open for exactly this caption element (used to avoid re-opening on hover). */
  isShowingFor(anchor: HTMLElement): boolean {
    return this.isOpen() && this.activation?.anchor === anchor && !this.activation.anchorRect;
  }

  containsEvent(event: Event): boolean {
    return this.tooltip.containsEvent(event);
  }

  toast(text: string): void {
    this.tooltip.toast(text, this.playerRect());
  }

  /** Close the card if the captions moved on while the pointer is somewhere else. */
  onCaptionChange(): void {
    if (this.isOpen() && !this.pointerInside) this.close();
  }

  open(activation: TermActivation): void {
    const wasOpen = this.isOpen();
    const id = ++this.requestId;
    this.activation = activation;

    const model = createInitialModel(
      activation.term,
      activation.isPhrase,
      this.deps.getSettings().nudgeDismissed,
    );
    this.model = model;
    this.tooltip.show(model, () => this.anchorRect(), () => this.playerRect());
    if (!wasOpen) {
      document.addEventListener('pointermove', this.onPointerMove, true);
      this.deps.onOpen?.();
    }

    void this.runLookup(id, activation);
    // EXPLAIN is sent right away (not after HAS_KEY) so the two round trips overlap.
    void this.runHasKey(id);
    void this.runExplain(id, activation);
    void this.refreshSaved(id);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.requestId++;
    this.tooltip.close();
    document.removeEventListener('pointermove', this.onPointerMove, true);
    this.pointerInside = false;
    this.activation = null;
    this.model = null;
    this.deps.onClose?.();
  }

  destroy(): void {
    this.close();
    this.tooltip.destroy();
  }

  // ---- requests -----------------------------------------------------------

  private isCurrent(id: number): boolean {
    return id === this.requestId && this.model !== null && this.tooltip.isOpen();
  }

  private patch(id: number, change: (model: CardModel) => CardModel): void {
    if (!this.isCurrent(id) || !this.model) return;
    this.model = change(this.model);
    this.tooltip.update(this.model);
  }

  private async runLookup(id: number, activation: TermActivation): Promise<void> {
    const result = await send<LookupData>({
      type: 'LOOKUP',
      term: activation.term,
      isPhrase: activation.isPhrase,
      ...(activation.phraseMeaning !== undefined ? { phraseMeaning: activation.phraseMeaning } : {}),
    });
    if (result.ok) {
      this.patch(id, (m) => ({
        ...m,
        dictionary: { status: 'ready', data: result.data.dictionary },
        level: result.data.level,
      }));
    } else {
      this.patch(id, (m) => ({ ...m, dictionary: { status: 'error', error: result.error } }));
    }
  }

  private async runHasKey(id: number): Promise<void> {
    const result = await send<boolean>({ type: 'HAS_KEY' });
    const hasKey = result.ok && result.data;
    this.knownHasKey = hasKey;
    // Don't clobber an EXPLAIN answer that already arrived.
    this.patch(id, (m) => ({
      ...m,
      hasKey,
      ai: hasKey ? (m.ai.status === 'idle' ? { status: 'loading' } : m.ai) : { status: 'idle' },
    }));
  }

  private explainRequest(activation: TermActivation): BgRequest {
    return {
      type: 'EXPLAIN',
      term: activation.term,
      context: activation.context,
      level: this.deps.getSettings().level,
      pageTitle: pageTitle(),
    };
  }

  /**
   * Warms the background cache while the pointer rests on a word, before any click. The click's own
   * EXPLAIN then joins the in-flight request or hits the cache. The answer is deliberately dropped.
   */
  prefetch(activation: TermActivation): void {
    if (this.knownHasKey === false) return;
    const request = this.explainRequest(activation);
    const key = JSON.stringify(request);
    if (key === this.lastPrefetch) return;
    this.lastPrefetch = key;
    void send<AiExplanation>(request);
  }

  private async runExplain(id: number, activation: TermActivation): Promise<void> {
    const result = await send<AiExplanation>(this.explainRequest(activation));
    if (result.ok) {
      this.knownHasKey = true;
      this.patch(id, (m) => ({ ...m, hasKey: true, ai: { status: 'ready', data: result.data } }));
    } else if (result.error.code === 'NO_KEY') {
      this.knownHasKey = false;
      this.patch(id, (m) => ({ ...m, hasKey: false, ai: { status: 'idle' } }));
    } else {
      this.patch(id, (m) => ({ ...m, ai: { status: 'error', error: result.error } }));
    }
  }

  private retry(kind: 'dictionary' | 'ai'): void {
    const activation = this.activation;
    const id = this.requestId;
    if (!activation || !this.model) return;
    if (kind === 'dictionary') {
      this.patch(id, (m) => ({ ...m, dictionary: { status: 'loading' } }));
      void this.runLookup(id, activation);
    } else {
      this.patch(id, (m) => ({ ...m, ai: { status: 'loading' } }));
      void this.runExplain(id, activation);
    }
  }

  // ---- saving -------------------------------------------------------------

  private async refreshSaved(id: number): Promise<void> {
    const term = this.activation?.term.toLowerCase();
    if (term === undefined) return;
    const words = await getSavedWords();
    const saved = words.some((w) => w.term.toLowerCase() === term);
    this.patch(id, (m) => ({ ...m, saved }));
  }

  private async toggleSave(): Promise<void> {
    const activation = this.activation;
    const model = this.model;
    if (!activation || !model) return;
    const id = this.requestId;

    if (model.saved) {
      const term = activation.term.toLowerCase();
      const matching = (await getSavedWords()).filter((w) => w.term.toLowerCase() === term);
      await Promise.all(matching.map((w) => send<null>({ type: 'REMOVE_WORD', id: w.id })));
      this.patch(id, (m) => ({ ...m, saved: false }));
      return;
    }

    const content = deriveCardContent(model);
    if (content.definition === null) return;
    const aiReady = model.ai.status === 'ready';
    const level: Cefr = content.levelKey ?? 'C2';
    const word: SavedWord = {
      id: `${activation.term.toLowerCase()}|${(await sha256Hex(activation.context)).slice(0, 8)}`,
      term: activation.term,
      definition: content.definition,
      context: activation.context,
      level,
      estimated: !aiReady,
      partOfSpeech: content.partOfSpeech ?? (activation.isPhrase ? 'idiom' : ''),
      site: this.deps.site,
      pageTitle: pageTitle(),
      url: location.href,
      savedAt: Date.now(),
    };
    await send<null>({ type: 'SAVE_WORD', word });
    this.patch(id, (m) => ({ ...m, saved: true }));
  }

  // ---- misc actions -------------------------------------------------------

  private navigate(direction: -1 | 1): void {
    const current = this.activation;
    if (!current) return;
    const next = this.deps.captions.getAdjacentActivation(current.anchor, direction);
    if (next) this.open(next);
  }

  private async openSettings(): Promise<void> {
    const result = await send<null>({ type: 'OPEN_SETTINGS' });
    if (!result.ok) this.toast(SETTINGS_HINT);
  }

  private async dismissNudge(): Promise<void> {
    await setSettings({ nudgeDismissed: true });
    this.patch(this.requestId, (m) => ({ ...m, nudgeDismissed: true }));
  }

  // ---- geometry -----------------------------------------------------------

  private anchorRect(): Rect {
    if (this.activation?.anchorRect) return this.activation.anchorRect;
    const anchor = this.activation?.anchor;
    if (anchor?.isConnected) {
      const r = anchor.getBoundingClientRect();
      this.lastAnchorRect = { top: r.top, left: r.left, width: r.width, height: r.height };
    }
    return this.lastAnchorRect;
  }

  private playerRect(): Rect | null {
    const player = this.deps.captions.getPlayer();
    if (!player) return null;
    const r = player.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointerInside = this.tooltip.containsEvent(event);
  };
}

