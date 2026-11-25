import { card } from '../shared/tokens';

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export type PlacementSide = 'above' | 'below' | 'left' | 'right';
export interface Placement {
  top: number;
  left: number;
  placement: PlacementSide;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where to put the card (docs/03 §4.5). Prefers above the anchor, then right, left, below.
 * Clamps to the viewport and never overlaps the bottom 64px of the player (its controls).
 */
export function computePlacement(
  anchor: Rect,
  cardSize: Size,
  viewport: Size,
  playerRect: Rect | null,
): Placement {
  const gap = card.placementGap;
  const margin = card.viewportMargin;
  const minLeft = margin;
  const maxLeft = viewport.width - cardSize.width - margin;
  const minTop = margin;
  const maxTop = viewport.height - cardSize.height - margin;

  const centredLeft = anchor.left + anchor.width / 2 - cardSize.width / 2;
  const centredTop = anchor.top + anchor.height / 2 - cardSize.height / 2;

  // Top edge of the controls band; the card must end above it when it would otherwise overlap.
  const controlsTop = playerRect
    ? playerRect.top + playerRect.height - card.controlsClearance
    : Number.POSITIVE_INFINITY;
  const playerBottom = playerRect ? playerRect.top + playerRect.height : Number.POSITIVE_INFINITY;

  const avoidControls = (top: number): number => {
    const overlaps = top + cardSize.height > controlsTop && top < playerBottom;
    return overlaps ? controlsTop - cardSize.height : top;
  };

  const candidates: Array<{ side: PlacementSide; top: number; left: number; fits: boolean }> = [];

  {
    const top = avoidControls(anchor.top - gap - cardSize.height);
    candidates.push({
      side: 'above',
      top,
      left: clamp(centredLeft, minLeft, maxLeft),
      fits: top >= minTop && top + cardSize.height <= anchor.top - gap + 0.5,
    });
  }
  {
    const left = anchor.left + anchor.width + gap;
    const top = avoidControls(clamp(centredTop, minTop, maxTop));
    candidates.push({
      side: 'right',
      top,
      left,
      fits: left + cardSize.width <= viewport.width - margin && top >= minTop,
    });
  }
  {
    const left = anchor.left - gap - cardSize.width;
    const top = avoidControls(clamp(centredTop, minTop, maxTop));
    candidates.push({ side: 'left', top, left, fits: left >= minLeft && top >= minTop });
  }
  {
    const top = anchor.top + anchor.height + gap;
    const shifted = avoidControls(top);
    candidates.push({
      side: 'below',
      top: shifted,
      left: clamp(centredLeft, minLeft, maxLeft),
      // Shifting a "below" card up would cover the anchor, so only accept it unshifted.
      fits: shifted === top && top + cardSize.height <= viewport.height - margin,
    });
  }

  const chosen = candidates.find((c) => c.fits);
  if (chosen) return { top: chosen.top, left: chosen.left, placement: chosen.side };

  // Nothing fits cleanly: keep it on screen above the anchor.
  const fallback = candidates[0] as (typeof candidates)[number];
  return {
    top: clamp(fallback.top, minTop, maxTop),
    left: clamp(fallback.left, minLeft, maxLeft),
    placement: 'above',
  };
}
