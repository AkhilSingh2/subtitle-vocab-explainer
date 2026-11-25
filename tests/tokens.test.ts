import { describe, expect, it } from 'vitest';
import { card, colors, levelBadge } from '../src/shared/tokens';

describe('design tokens', () => {
  it('matches the values in the UX spec', () => {
    expect(colors.accent).toBe('#7C9CFF');
    expect(card.width).toBe(340);
    expect(card.controlsClearance).toBe(64);
    expect(levelBadge.C1.text).toBe('#A78BFA');
  });
});
