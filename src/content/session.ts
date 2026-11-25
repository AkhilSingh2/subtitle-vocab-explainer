import type { ContentState, Settings } from '../shared/types';
import { CaptionController } from './captionController';
import { CardController } from './cardController';
import { SmartPause } from './smartPause';
import type { SiteAdapter } from './siteAdapters';

const HOVER_DWELL_MS = 350;
const PREFETCH_DWELL_MS = 150;
const SELECTION_CLICK_SUPPRESS_MS = 300;

/**
 * Everything that runs on one watch page: caption wrapping, the hover card, smart pause, hover-dwell
 * and drag-select. Created when the extension should be active, destroyed when it should not.
 */
export class ContentSession {
  private readonly captions: CaptionController;
  private readonly card: CardController;
  private readonly pause: SmartPause;
  private pointerInside = false;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly adapter: SiteAdapter,
    private readonly getSettings: () => Settings,
  ) {
    this.captions = new CaptionController(
      adapter,
      (activation) => this.card.open(activation),
      () => this.card.onCaptionChange(),
    );
    this.pause = new SmartPause({
      getVideo: () => this.captions.getVideo(),
      isEnabled: () => this.getSettings().smartPause,
      onToast: () => this.card.toast('Paused for lookup'),
    });
    this.card = new CardController({
      captions: this.captions,
      site: adapter.id,
      getSettings,
      onOpen: () => this.pause.onCardOpen(),
      onClose: () => this.pause.onCardClose(this.pointerInside),
    });
  }

  start(saved: ReadonlySet<string>): void {
    this.captions.setSaved(saved);
    this.captions.start();
    document.addEventListener('pointerover', this.onPointerOver, true);
    document.addEventListener('pointerout', this.onPointerOut, true);
    document.addEventListener('mouseup', this.onMouseUp, true);
    document.addEventListener('play', this.onPlay, true);
  }

  stop(): void {
    document.removeEventListener('pointerover', this.onPointerOver, true);
    document.removeEventListener('pointerout', this.onPointerOut, true);
    document.removeEventListener('mouseup', this.onMouseUp, true);
    document.removeEventListener('play', this.onPlay, true);
    this.clearHoverTimer();
    this.card.destroy();
    this.captions.stop();
  }

  setSaved(saved: ReadonlySet<string>): void {
    this.captions.setSaved(saved);
  }

  resetContext(): void {
    this.captions.resetContext();
    this.card.close();
  }

  getState(): Pick<ContentState, 'captionsStatus'> {
    return { captionsStatus: this.captions.getStatus() };
  }

  // ---- pointer tracking (smart pause + hover trigger) ---------------------

  private setInside(inside: boolean): void {
    if (inside === this.pointerInside) return;
    this.pointerInside = inside;
    if (inside) this.pause.onCaptionEnter();
    else this.pause.onCaptionLeave(this.card.isOpen());
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
    if (this.prefetchTimer !== null) clearTimeout(this.prefetchTimer);
    this.prefetchTimer = null;
  }

  /** Starts the AI request a moment after the pointer rests on a word, so a click feels instant. */
  private schedulePrefetch(target: EventTarget | null): void {
    if (!(target instanceof Element)) return;
    const wordEl = target.closest<HTMLElement>('.sve-w');
    if (!wordEl) return;
    const anchor = wordEl.closest<HTMLElement>('.sve-p') ?? wordEl;
    this.prefetchTimer = setTimeout(() => {
      this.prefetchTimer = null;
      const activation = this.captions.activationFor(anchor);
      if (activation) this.card.prefetch(activation);
    }, PREFETCH_DWELL_MS);
  }

  private readonly onPointerOver = (event: PointerEvent): void => {
    const target = event.target;
    this.setInside(this.captions.isCaptionTarget(target) || this.card.containsEvent(event));

    this.clearHoverTimer();
    this.schedulePrefetch(target);
    if (this.getSettings().cardTrigger !== 'hover' || !(target instanceof Element)) return;
    const wordEl = target.closest<HTMLElement>('.sve-w');
    if (!wordEl) return;
    const anchor = wordEl.closest<HTMLElement>('.sve-p') ?? wordEl;
    if (this.card.isShowingFor(anchor)) return;
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      const activation = this.captions.activationFor(anchor);
      if (activation) this.card.open(activation);
    }, HOVER_DWELL_MS);
  };

  private readonly onPointerOut = (event: PointerEvent): void => {
    // relatedTarget is null when the pointer leaves the browser window.
    if (event.relatedTarget === null) {
      this.clearHoverTimer();
      this.setInside(false);
    }
  };

  // ---- drag-select ---------------------------------------------------------

  private readonly onMouseUp = (): void => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const activation = this.captions.activationForSelection(selection);
    if (!activation) return;
    selection.removeAllRanges();
    this.captions.suppressClicks(SELECTION_CLICK_SUPPRESS_MS);
    this.card.open(activation);
  };

  // ---- video events --------------------------------------------------------

  private readonly onPlay = (event: Event): void => {
    if (event.target instanceof HTMLVideoElement && event.target === this.captions.getVideo()) {
      this.pause.onVideoPlay();
    }
  };
}
