import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SmartPause } from '../src/content/smartPause';

interface FakeVideo {
  paused: boolean;
  ended: boolean;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  currentTime: number;
}

function fakeVideo(paused = false): FakeVideo {
  const v: FakeVideo = {
    paused,
    ended: false,
    currentTime: 42,
    pause: vi.fn(() => {
      v.paused = true;
    }),
    play: vi.fn(async () => {
      v.paused = false;
    }),
  };
  return v;
}

let video: FakeVideo;
let enabled: boolean;
let toast: ReturnType<typeof vi.fn>;
let time: number;
let sp: SmartPause;

beforeEach(() => {
  video = fakeVideo(false);
  enabled = true;
  toast = vi.fn();
  time = 1_000_000;
  sp = new SmartPause({
    getVideo: () => video as unknown as HTMLVideoElement,
    isEnabled: () => enabled,
    onToast: toast,
    now: () => time,
  });
});

/** Simulates the browser firing a `play` event after we (or the user) call play(). */
const firePlay = (): void => {
  video.paused = false;
  sp.onVideoPlay();
};

describe('SmartPause (docs/03 §5)', () => {
  it('pauses when the pointer enters the captions while playing, and shows the toast', () => {
    sp.onCaptionEnter();
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('pauses when a card opens while playing', () => {
    sp.onCardOpen();
    expect(video.pause).toHaveBeenCalledTimes(1);
  });

  it('resumes when the pointer leaves and no card is open, only if we paused', () => {
    sp.onCaptionEnter();
    sp.onCaptionLeave(false);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('does not resume while a card is open, then resumes when it closes with the pointer away', () => {
    sp.onCaptionEnter();
    sp.onCardOpen();
    sp.onCaptionLeave(true);
    expect(video.play).not.toHaveBeenCalled();
    sp.onCardClose(false);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('waits for the pointer to leave if the card closes while it is still over the captions', () => {
    sp.onCardOpen();
    sp.onCardClose(true);
    expect(video.play).not.toHaveBeenCalled();
    sp.onCaptionLeave(false);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('never resumes a video the user had already paused', () => {
    video.paused = true;
    sp.onCaptionEnter();
    sp.onCardOpen();
    sp.onCaptionLeave(false);
    sp.onCardClose(false);
    expect(video.pause).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('does not re-pause on hover after the user presses play manually while paused by us', () => {
    sp.onCaptionEnter();
    expect(video.pause).toHaveBeenCalledTimes(1);
    firePlay(); // user presses play
    sp.onCaptionEnter();
    expect(video.pause).toHaveBeenCalledTimes(1);
    // leaving and re-entering captions makes hover-pause work again
    sp.onCaptionLeave(false);
    sp.onCaptionEnter();
    expect(video.pause).toHaveBeenCalledTimes(2);
  });

  it('pauses again on the next card open after a manual play', () => {
    sp.onCaptionEnter();
    firePlay();
    sp.onCardOpen();
    expect(video.pause).toHaveBeenCalledTimes(2);
  });

  it('does not treat its own play() as a manual play', () => {
    sp.onCaptionEnter();
    sp.onCaptionLeave(false); // we resume
    firePlay(); // the resulting play event
    sp.onCaptionEnter();
    expect(video.pause).toHaveBeenCalledTimes(2); // hover pause still works
  });

  it('does nothing when smart pause is disabled', () => {
    enabled = false;
    sp.onCaptionEnter();
    sp.onCardOpen();
    sp.onCaptionLeave(false);
    expect(video.pause).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('does not resume if smart pause was switched off while paused', () => {
    sp.onCaptionEnter();
    enabled = false;
    sp.onCaptionLeave(false);
    expect(video.play).not.toHaveBeenCalled();
  });

  it('rate-limits the toast to once every 10 seconds', () => {
    sp.onCaptionEnter();
    sp.onCaptionLeave(false);
    firePlay();
    time += 5_000;
    sp.onCaptionEnter();
    expect(toast).toHaveBeenCalledTimes(1);
    sp.onCaptionLeave(false);
    firePlay();
    time += 6_000;
    sp.onCaptionEnter();
    expect(toast).toHaveBeenCalledTimes(2);
  });

  it('never seeks', () => {
    sp.onCaptionEnter();
    sp.onCaptionLeave(false);
    expect(video.currentTime).toBe(42);
  });

  it('handles a missing video or a failing play() without throwing', async () => {
    const orphan = new SmartPause({ getVideo: () => null, isEnabled: () => true, onToast: toast });
    expect(() => {
      orphan.onCaptionEnter();
      orphan.onCardOpen();
      orphan.onCaptionLeave(false);
    }).not.toThrow();

    video.play = vi.fn(async () => {
      throw new DOMException('blocked', 'NotAllowedError');
    });
    sp.onCaptionEnter();
    sp.onCaptionLeave(false);
    await Promise.resolve();
    // a later manual play must still be recognised as manual (flag was reset)
    sp.onCaptionEnter();
    firePlay();
    sp.onCaptionEnter();
    expect(video.pause).toHaveBeenCalledTimes(2);
  });
});
