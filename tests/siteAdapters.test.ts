import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAdapter,
  getCaptionLines,
  netflixAdapter,
  queryFirst,
  youtubeAdapter,
} from '../src/content/siteAdapters';
import { wrapLine } from '../src/content/captionWrapper';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('getAdapter / matchesUrl', () => {
  it('maps hostnames to adapters', () => {
    expect(getAdapter('www.youtube.com')).toBe(youtubeAdapter);
    expect(getAdapter('www.netflix.com')).toBe(netflixAdapter);
    expect(getAdapter('example.com')).toBeNull();
  });

  it('only treats watch pages as active', () => {
    expect(youtubeAdapter.matchesUrl({ pathname: '/watch' })).toBe(true);
    expect(youtubeAdapter.matchesUrl({ pathname: '/' })).toBe(false);
    expect(youtubeAdapter.matchesUrl({ pathname: '/shorts/abc' })).toBe(false);
    expect(netflixAdapter.matchesUrl({ pathname: '/watch/80100172' })).toBe(true);
    expect(netflixAdapter.matchesUrl({ pathname: '/browse' })).toBe(false);
  });
});

describe('queryFirst', () => {
  it('falls back to later selectors when earlier ones do not match', () => {
    document.body.innerHTML = '<div class="b"></div>';
    expect(queryFirst(['.a', '.b'])?.className).toBe('b');
    expect(queryFirst(['.a', '.c'])).toBeNull();
  });
});

describe('getCaptionLines', () => {
  it('returns YouTube caption segments with text', () => {
    document.body.innerHTML = `
      <div class="ytp-caption-window-container">
        <span class="ytp-caption-segment">Hello there</span>
        <span class="ytp-caption-segment">   </span>
        <span class="ytp-caption-segment">How are you</span>
      </div>`;
    const root = document.querySelector('.ytp-caption-window-container') as HTMLElement;
    expect(getCaptionLines(youtubeAdapter, root).map((l) => l.textContent)).toEqual([
      'Hello there',
      'How are you',
    ]);
  });

  it('returns only leaf spans on Netflix, not their wrappers', () => {
    document.body.innerHTML = `
      <div class="player-timedtext">
        <div class="player-timedtext-text-container">
          <span style="x"><span>First line</span><br><span>Second line</span></span>
        </div>
      </div>`;
    const root = document.querySelector('.player-timedtext') as HTMLElement;
    expect(getCaptionLines(netflixAdapter, root).map((l) => l.textContent)).toEqual([
      'First line',
      'Second line',
    ]);
  });

  it('does not treat our own wrappers as caption lines after wrapping', () => {
    document.body.innerHTML = `
      <div class="player-timedtext">
        <div class="player-timedtext-text-container"><span><span>Break the ice</span></span></div>
      </div>`;
    const root = document.querySelector('.player-timedtext') as HTMLElement;
    const [first] = getCaptionLines(netflixAdapter, root);
    wrapLine(first as HTMLElement, { phrases: [], saved: new Set() });
    const lines = getCaptionLines(netflixAdapter, root);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(first);
  });
});
