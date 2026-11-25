const TOAST_MIN_INTERVAL_MS = 10_000;

export interface SmartPauseDeps {
  getVideo: () => HTMLVideoElement | null;
  /** The "Smart pause" setting. When false, the video is never paused or resumed. */
  isEnabled: () => boolean;
  /** Shows "Paused for lookup". Rate limited here to once every 10 seconds. */
  onToast: () => void;
  now?: () => number;
}

/**
 * Pauses the video while the user looks something up and resumes it afterwards, but only if *we*
 * paused it (docs/03 §5). Uses `pause()` / `play()` only — never seeks.
 */
export class SmartPause {
  private pausedByUs = false;
  /** Set when the user presses play themselves while we had paused: don't re-pause on hover. */
  private suppressHoverPause = false;
  private ourPlayInFlight = false;
  private lastToastAt = Number.NEGATIVE_INFINITY;
  private readonly now: () => number;

  constructor(private readonly deps: SmartPauseDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  /** The pointer moved onto the captions (or the card). */
  onCaptionEnter(): void {
    if (this.suppressHoverPause) return;
    this.pauseIfPlaying();
  }

  /** The pointer left the captions and the card. */
  onCaptionLeave(isCardOpen: boolean): void {
    this.suppressHoverPause = false;
    if (!isCardOpen) this.resumeIfOurs();
  }

  onCardOpen(): void {
    this.suppressHoverPause = false;
    this.pauseIfPlaying();
  }

  onCardClose(isPointerOverCaptions: boolean): void {
    // If the pointer is still on the captions, resume when it leaves instead.
    if (!isPointerOverCaptions) this.resumeIfOurs();
  }

  /** Call for every `play` event on the video. Plays we trigger ourselves are ignored. */
  onVideoPlay(): void {
    if (this.ourPlayInFlight) {
      this.ourPlayInFlight = false;
      return;
    }
    if (this.pausedByUs) {
      this.pausedByUs = false;
      this.suppressHoverPause = true;
    }
  }

  private pauseIfPlaying(): void {
    if (!this.deps.isEnabled()) return;
    const video = this.deps.getVideo();
    if (!video || video.paused || video.ended) return;
    video.pause();
    this.pausedByUs = true;
    const now = this.now();
    if (now - this.lastToastAt >= TOAST_MIN_INTERVAL_MS) {
      this.lastToastAt = now;
      this.deps.onToast();
    }
  }

  private resumeIfOurs(): void {
    if (!this.pausedByUs) return;
    this.pausedByUs = false;
    if (!this.deps.isEnabled()) return;
    const video = this.deps.getVideo();
    if (!video || !video.paused || video.ended) return;
    this.ourPlayInFlight = true;
    video.play().catch(() => {
      this.ourPlayInFlight = false;
    });
  }
}
