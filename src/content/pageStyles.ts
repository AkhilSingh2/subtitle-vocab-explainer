import { colors } from '../shared/tokens';
import type { SiteAdapter } from './siteAdapters';

export const PAGE_STYLE_ID = 'sve-page-styles';

/**
 * Host-page CSS for caption highlighting (docs/03 §3). Zero layout shift: only background and
 * text-decoration change, never padding, margin, font or line-height.
 */
export function buildPageCss(adapter: SiteAdapter): string {
  const lineSelectors = adapter.captionLineSelectors.join(', ');
  return `
${lineSelectors} {
  pointer-events: auto !important;
  user-select: text !important;
  -webkit-user-select: text !important;
}
.sve-w {
  cursor: pointer;
  border-radius: 4px;
  transition: background 80ms;
  pointer-events: auto !important;
  user-select: text !important;
}
.sve-w:hover,
.sve-p:hover .sve-w {
  background: ${colors.hoverBg};
}
.sve-p {
  text-decoration: underline dotted ${colors.idiom} 2px;
  text-underline-offset: 3px;
}
.sve-saved {
  text-decoration: underline solid ${colors.success} 1px;
  text-underline-offset: 3px;
}
.sve-p .sve-saved {
  text-decoration: none;
}
@media (prefers-reduced-motion: reduce) {
  .sve-w { transition: none; }
}
`.trim();
}
