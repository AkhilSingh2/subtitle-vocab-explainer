import { motion, zIndexMax } from '../shared/tokens';
import { aiErrorCopy, deriveCardContent, type CardContent, type CardModel } from './cardContent';
import { h } from './dom';
import { computePlacement, type Rect } from './placement';
import { tooltipCss } from './tooltip.css';

export interface TooltipHandlers {
  onClose(): void;
  onToggleSave(): void;
  onRetry(kind: 'dictionary' | 'ai'): void;
  onNavigate(direction: -1 | 1): void;
  onOpenSettings(): void;
  onDismissNudge(): void;
}

export interface TooltipOptions {
  /** Production always uses 'closed'; tests use 'open' so they can inspect the DOM. */
  shadowMode?: ShadowRootMode;
}

const HOST_ID = 'sve-host';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The hover card and toast. Lives in a Shadow Root attached to `document.body` (or the fullscreen
 * element) so YouTube/Netflix CSS can't touch it and ours can't leak out. All text is inserted
 * as text nodes.
 */
export class ShadowTooltip {
  private readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly layer: HTMLElement;

  private cardEl: HTMLElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;
  private sections = new Map<string, { el: HTMLElement; key: string }>();
  private open = false;
  private rendered = false;
  private model: CardModel | null = null;
  private content: CardContent | null = null;
  private getAnchorRect: (() => Rect) | null = null;
  private getPlayerRect: (() => Rect | null) | null = null;
  private prevFocus: HTMLElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private playing = false;
  private toastEl: HTMLElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly handlers: TooltipHandlers,
    options: TooltipOptions = {},
  ) {
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.host.style.cssText = `all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: ${zIndexMax};`;
    this.root = this.host.attachShadow({ mode: options.shadowMode ?? 'closed' });
    this.root.append(h('style', { text: tooltipCss }));
    this.layer = h('div', { class: 'layer' });
    this.root.append(this.layer);
    this.parent().append(this.host);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  // ---- public API ----------------------------------------------------------

  isOpen(): boolean {
    return this.open;
  }

  /** True if the event happened inside the card (works across the shadow boundary). */
  containsEvent(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  show(model: CardModel, getAnchorRect: () => Rect, getPlayerRect: () => Rect | null): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.getAnchorRect = getAnchorRect;
    this.getPlayerRect = getPlayerRect;

    if (!this.open) {
      this.prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.buildCard();
      this.attachGlobalListeners();
      this.open = true;
    } else {
      // Re-targeted to another word: rebuild content without fading.
      this.rendered = false;
      this.sections.forEach((s) => (s.key = ''));
    }

    this.model = model;
    this.render();
    this.reposition();
    requestAnimationFrame(() => this.cardEl?.classList.add('open'));
    this.closeBtn?.focus({ preventScroll: true });
  }

  update(model: CardModel): void {
    if (!this.open) return;
    this.model = model;
    this.render();
    this.reposition();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.detachGlobalListeners();
    this.stopAudio();
    const card = this.cardEl;
    card?.classList.add('closing');
    card?.classList.remove('open');
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      card?.remove();
    }, motion.closeMs);
    this.cardEl = null;
    this.closeBtn = null;
    this.sections.clear();
    this.model = null;
    this.content = null;
    this.rendered = false;
    const prev = this.prevFocus;
    this.prevFocus = null;
    if (prev && prev.isConnected) prev.focus({ preventScroll: true });
  }

  reposition(): void {
    const card = this.cardEl;
    if (!card || !this.getAnchorRect) return;
    const viewport = {
      width: document.documentElement.clientWidth || window.innerWidth,
      height: document.documentElement.clientHeight || window.innerHeight,
    };
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    const placement = computePlacement(
      this.getAnchorRect(),
      size,
      viewport,
      this.getPlayerRect ? this.getPlayerRect() : null,
    );
    card.style.left = `${Math.round(placement.left)}px`;
    if (placement.placement === 'above') {
      // Anchor the bottom edge so the card grows upward and never covers the word.
      card.style.top = 'auto';
      card.style.bottom = `${Math.round(viewport.height - (placement.top + size.height))}px`;
    } else {
      card.style.bottom = 'auto';
      card.style.top = `${Math.round(placement.top)}px`;
    }
  }

  toast(text: string, playerRect: Rect | null): void {
    if (!this.toastEl) {
      this.toastEl = h('div', { class: 'toast', attrs: { role: 'status' } });
      this.layer.append(this.toastEl);
    }
    const el = this.toastEl;
    el.textContent = text;
    const left = playerRect ? playerRect.left + 16 : 16;
    // Sit above the player's control bar (64px) with a 16px gap.
    const bottomEdge = playerRect ? playerRect.top + playerRect.height : window.innerHeight;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(bottomEdge - 80 - 28)}px`;
    el.classList.add('show');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.classList.remove('show');
      this.toastTimer = null;
    }, motion.toastVisibleMs);
  }

  pronounce(): void {
    if (!this.model) return;
    this.stopAudio();
    const url = this.content?.audioUrl ?? null;
    const speak = (): void => this.speak(this.model?.term ?? '');
    if (url) {
      const audio = new Audio(url);
      this.audio = audio;
      this.setPlaying(true);
      audio.addEventListener('ended', () => this.setPlaying(false));
      audio.addEventListener('error', () => {
        this.setPlaying(false);
        speak();
      });
      audio.play().catch(() => {
        this.setPlaying(false);
        speak();
      });
    } else {
      speak();
    }
  }

  destroy(): void {
    this.close();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.host.remove();
  }

  // ---- rendering -----------------------------------------------------------

  private buildCard(): void {
    const header = h('div', { class: 'header' });
    const body = h('div', { class: 'body' });
    const definition = h('div');
    const scene = h('div');
    const nudge = h('div');
    body.append(definition, scene, nudge);
    const footer = h('div', { class: 'footer' });

    const card = h('div', { class: 'card', attrs: { role: 'dialog', 'aria-modal': 'false' } }, header, body, footer);
    this.layer.append(card);
    this.cardEl = card;
    this.sections = new Map([
      ['header', { el: header, key: '' }],
      ['definition', { el: definition, key: '' }],
      ['scene', { el: scene, key: '' }],
      ['nudge', { el: nudge, key: '' }],
      ['footer', { el: footer, key: '' }],
    ]);
    this.rendered = false;
  }

  /** Replaces a section's children only when its key changed; fades in updates after the first paint. */
  private fill(name: string, key: string, build: () => Array<Node | null>): void {
    const section = this.sections.get(name);
    if (!section || section.key === key) return;
    const isFirst = section.key === '';
    section.key = key;
    section.el.replaceChildren(...build().filter((n): n is Node => n !== null));
    if (this.rendered && !isFirst) {
      section.el.classList.remove('fade');
      void section.el.offsetWidth;
      section.el.classList.add('fade');
    }
  }

  private render(): void {
    const model = this.model;
    const card = this.cardEl;
    if (!model || !card) return;
    const content = deriveCardContent(model);
    this.content = content;
    card.setAttribute('aria-label', `Definition of ${model.term}`);

    const dictLoading = model.dictionary.status === 'loading';
    const dictReady = model.dictionary.status === 'ready';
    const aiReady = model.ai.status === 'ready';
    const canShowActions = dictReady || aiReady;

    this.fill('header', JSON.stringify([model.term, content, canShowActions, this.playing]), () => [
      this.buildHeader(model, content, canShowActions),
    ]);
    this.fill('definition', JSON.stringify([model.dictionary, model.hasKey, content.definition, aiReady ? null : content.example]), () => [
      this.buildDefinition(model, content),
    ]);
    this.fill('scene', JSON.stringify([model.hasKey, model.ai]), () => [this.buildScene(model)]);
    this.fill(
      'nudge',
      JSON.stringify([model.hasKey, model.nudgeDismissed, dictLoading]),
      () => [this.buildNudge(model, dictLoading)],
    );
    this.fill('footer', JSON.stringify([model.saved, content.definition === null]), () =>
      this.buildFooter(model, content),
    );
    this.rendered = true;
  }

  private buildHeader(model: CardModel, content: CardContent, canShowActions: boolean): Node {
    const closeBtn = h('button', {
      class: 'icon-btn',
      text: '✕',
      attrs: { type: 'button', 'aria-label': 'Close' },
      on: { click: () => this.handlers.onClose() },
    });
    this.closeBtn = closeBtn;

    const titleRow = h(
      'div',
      { class: 'title-row' },
      h('div', { class: 'term', text: model.term }),
      canShowActions
        ? h('button', {
            class: this.playing ? 'icon-btn active' : 'icon-btn',
            text: '🔊',
            attrs: { type: 'button', 'aria-label': 'Pronounce' },
            on: { click: () => this.pronounce() },
          })
        : null,
      canShowActions && content.levelLabel && content.levelKey
        ? h('span', { class: `badge lvl-${content.levelKey}`, text: content.levelLabel })
        : null,
      closeBtn,
    );

    const metaParts: Array<Node | string> = [];
    if (content.ipa) metaParts.push(content.ipa);
    if (content.partOfSpeech) {
      metaParts.push(
        content.partOfSpeech === 'idiom'
          ? h('span', { class: 'idiom-tag', text: 'idiom' })
          : content.partOfSpeech,
      );
    }
    if (content.register) metaParts.push(content.register);

    const meta = h('div', { class: 'meta' });
    metaParts.forEach((part, i) => {
      if (i > 0) meta.append(' · ');
      meta.append(part);
    });

    return h('div', {}, titleRow, metaParts.length > 0 ? meta : null);
  }

  private skeleton(widths: Array<'w100' | 'w85' | 'w60'>): HTMLElement {
    return h(
      'div',
      { class: 'skeleton', attrs: { 'aria-hidden': 'true' } },
      ...widths.map((w) => h('div', { class: `bar ${w}` })),
    );
  }

  private retryButton(kind: 'dictionary' | 'ai'): HTMLElement {
    return h('button', {
      class: 'btn',
      text: 'Retry',
      attrs: { type: 'button' },
      on: { click: () => this.handlers.onRetry(kind) },
    });
  }

  private buildDefinition(model: CardModel, content: CardContent): Node {
    const aiReady = model.ai.status === 'ready';
    const wrap = h('div');

    if (content.definition) {
      wrap.append(h('div', { text: content.definition }));
      if (!aiReady && content.example) {
        wrap.append(h('div', { class: 'example', text: `“${content.example}”` }));
      }
      return wrap;
    }

    if (model.dictionary.status === 'loading') return this.skeleton(['w100', 'w85', 'w60']);

    if (model.dictionary.status === 'error') {
      return h(
        'div',
        { class: 'skeleton' },
        h('div', { class: 'error-text', text: 'Couldn’t reach the dictionary.' }),
        this.retryButton('dictionary'),
      );
    }

    // Dictionary answered but had no entry (and the AI has not supplied a definition).
    const lines: Array<Node | null> = [h('div', { text: `No dictionary entry for ‘${model.term}’.` })];
    if (model.hasKey === false) {
      lines.push(h('div', { class: 'muted', text: 'It may be a name or slang.' }));
    }
    return h('div', {}, ...lines);
  }

  private buildScene(model: CardModel): Node {
    if (model.hasKey !== true) return h('div');
    const label = h('div', { class: 'section-label', text: 'In this scene' });
    const ai = model.ai;

    if (ai.status === 'ready') {
      const { inContext, example, simpler } = ai.data;
      return h(
        'div',
        {},
        label,
        h('div', { text: inContext }),
        example ? h('div', { class: 'example', text: `“${example}”` }) : null,
        simpler ? h('div', { class: 'simpler', text: `Simpler: ${simpler}` }) : null,
      );
    }

    if (ai.status === 'error') {
      const copy = aiErrorCopy(ai.error);
      return h(
        'div',
        {},
        label,
        h('div', { class: 'skeleton' },
          h('div', { class: 'error-text', text: copy.text }),
          copy.action === 'settings'
            ? h('button', {
                class: 'btn',
                text: 'Open Settings',
                attrs: { type: 'button' },
                on: { click: () => this.handlers.onOpenSettings() },
              })
            : this.retryButton('ai'),
        ),
      );
    }

    return h(
      'div',
      {},
      label,
      this.skeleton(['w100', 'w85']),
      h('div', { class: 'muted', text: 'Reading the scene…' }),
    );
  }

  private buildNudge(model: CardModel, dictLoading: boolean): Node {
    if (model.hasKey !== false || model.nudgeDismissed || dictLoading) return h('div');
    return h(
      'div',
      { class: 'nudge' },
      h('span', { text: '✨' }),
      h('button', {
        class: 'btn link grow',
        text: 'Add an AI key in Settings for in-context meaning →',
        attrs: { type: 'button' },
        on: { click: () => this.handlers.onOpenSettings() },
      }),
      h('button', {
        class: 'icon-btn',
        text: '✕',
        attrs: { type: 'button', 'aria-label': 'Dismiss' },
        on: { click: () => this.handlers.onDismissNudge() },
      }),
    );
  }

  private buildFooter(model: CardModel, content: CardContent): Node[] {
    const save = h('button', {
      class: model.saved ? 'btn saved' : 'btn',
      text: model.saved ? '✓ Saved' : '☆ Save word',
      attrs: { type: 'button', 'aria-label': model.saved ? 'Remove saved word' : 'Save word' },
      on: { click: () => this.handlers.onToggleSave() },
    });
    save.disabled = content.definition === null && !model.saved;
    return [save, h('span', { class: 'hint', text: '← →  · Esc close' })];
  }

  // ---- audio ---------------------------------------------------------------

  private setPlaying(value: boolean): void {
    if (this.playing === value) return;
    this.playing = value;
    if (this.open) this.render();
  }

  private speak(text: string): void {
    if (!('speechSynthesis' in window) || text === '') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    this.setPlaying(true);
    utterance.onend = () => this.setPlaying(false);
    utterance.onerror = () => this.setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  private stopAudio(): void {
    this.audio?.pause();
    this.audio = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.playing = false;
  }

  // ---- global listeners ----------------------------------------------------

  private attachGlobalListeners(): void {
    window.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('scroll', this.onViewportChange, true);
  }

  private detachGlobalListeners(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('scroll', this.onViewportChange, true);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target)) return;

    const consume = (): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    switch (event.key) {
      case 'Escape':
        consume();
        this.handlers.onClose();
        break;
      case 's':
      case 'S':
        consume();
        this.handlers.onToggleSave();
        break;
      case 'p':
      case 'P':
        consume();
        this.pronounce();
        break;
      case 'ArrowLeft':
        consume();
        this.handlers.onNavigate(-1);
        break;
      case 'ArrowRight':
        consume();
        this.handlers.onNavigate(1);
        break;
      default:
        break;
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.open || this.containsEvent(event)) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.sve-w')) return;
    this.handlers.onClose();
  };

  private readonly onViewportChange = (): void => {
    if (this.open) this.reposition();
  };

  private readonly onFullscreenChange = (): void => {
    this.parent().append(this.host);
    if (this.open) this.reposition();
  };

  private parent(): HTMLElement {
    return (document.fullscreenElement as HTMLElement | null) ?? document.body;
  }
}
