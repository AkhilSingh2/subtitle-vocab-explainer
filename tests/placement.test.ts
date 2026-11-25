import { describe, expect, it } from 'vitest';
import { computePlacement, type Rect } from '../src/content/placement';

const viewport = { width: 1000, height: 800 };
const card = { width: 340, height: 300 };
const player: Rect = { top: 0, left: 0, width: 1000, height: 800 };
const anchor = (top: number, left: number, width = 60, height = 24): Rect => ({
  top,
  left,
  width,
  height,
});

describe('computePlacement', () => {
  it('prefers above the anchor, centred, with an 8px gap', () => {
    const r = computePlacement(anchor(500, 470), card, viewport, player);
    expect(r.placement).toBe('above');
    expect(r.top).toBe(500 - 8 - 300);
    expect(r.left).toBe(470 + 30 - 170);
  });

  it('moves to the right when there is no room above', () => {
    const r = computePlacement(anchor(20, 100), card, viewport, player);
    expect(r.placement).toBe('right');
    expect(r.left).toBe(100 + 60 + 8);
    expect(r.top).toBeGreaterThanOrEqual(8);
  });

  it('moves to the left when there is no room above or on the right', () => {
    const r = computePlacement(anchor(20, 880, 80), card, viewport, player);
    expect(r.placement).toBe('left');
    expect(r.left).toBe(880 - 8 - 340);
  });

  it('uses below when above, right and left do not fit', () => {
    const narrow = { width: 400, height: 800 };
    const r = computePlacement(
      anchor(20, 170, 60),
      { width: 340, height: 300 },
      narrow,
      { top: 0, left: 0, width: 400, height: 800 },
    );
    expect(r.placement).toBe('below');
    expect(r.top).toBe(20 + 24 + 8);
  });

  it('clamps horizontally to an 8px viewport margin', () => {
    const atLeftEdge = computePlacement(anchor(500, 0, 40), card, viewport, player);
    expect(atLeftEdge.left).toBe(8);
    const atRightEdge = computePlacement(anchor(500, 980, 20), card, viewport, player);
    expect(atRightEdge.left).toBe(1000 - 340 - 8);
  });

  it('never overlaps the bottom 64px of the player (controls)', () => {
    const controlsTop = 800 - 64;
    for (let top = 0; top <= 780; top += 20) {
      for (let left = 0; left <= 940; left += 60) {
        const r = computePlacement(anchor(top, left), card, viewport, player);
        const overlaps = r.top + card.height > controlsTop;
        expect(overlaps, `anchor ${top},${left} -> ${JSON.stringify(r)}`).toBe(false);
      }
    }
  });

  it('works without a player rect', () => {
    const r = computePlacement(anchor(500, 470), card, viewport, null);
    expect(r.placement).toBe('above');
  });

  it('keeps the card on screen even when nothing fits cleanly', () => {
    const tiny = { width: 340, height: 200 };
    const r = computePlacement(anchor(80, 100, 20, 20), { width: 340, height: 600 }, tiny, null);
    expect(r.top).toBeGreaterThanOrEqual(8);
    expect(r.left).toBeGreaterThanOrEqual(8);
  });
});
