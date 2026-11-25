import { describe, expect, it } from 'vitest';
import { CaptionHistory } from '../src/content/captionHistory';

describe('CaptionHistory', () => {
  it('returns previous + current sentence', () => {
    const h = new CaptionHistory();
    h.push('First sentence.');
    h.push('Second sentence.');
    expect(h.getContext()).toBe('First sentence. Second sentence.');
  });

  it('keeps only the last two sentences', () => {
    const h = new CaptionHistory();
    h.push('One.');
    h.push('Two.');
    h.push('Three.');
    expect(h.getContext()).toBe('Two. Three.');
  });

  it('ignores empty input and exact repeats', () => {
    const h = new CaptionHistory();
    h.push('   ');
    h.push('Hello there');
    h.push('Hello   there');
    expect(h.getContext()).toBe('Hello there');
  });

  it('replaces the latest entry when a caption grows word by word', () => {
    const h = new CaptionHistory();
    h.push('Earlier line.');
    h.push('so we');
    h.push('so we went');
    h.push('so we went home');
    expect(h.getContext()).toBe('Earlier line. so we went home');
  });

  it('caps context at 300 characters, trimming from the start', () => {
    const h = new CaptionHistory();
    h.push('a'.repeat(200));
    h.push('b '.repeat(100));
    const ctx = h.getContext();
    expect(ctx.length).toBeLessThanOrEqual(300);
    expect(ctx.endsWith('b')).toBe(true);
  });

  it('can be cleared', () => {
    const h = new CaptionHistory();
    h.push('Something');
    h.clear();
    expect(h.getContext()).toBe('');
  });
});
