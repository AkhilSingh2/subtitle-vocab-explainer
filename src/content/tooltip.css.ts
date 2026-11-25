import { button, card, colors, fontStack, levelBadge, motion, spacing, typeScale } from '../shared/tokens';

const badge = (level: keyof typeof levelBadge): string =>
  `.badge.lvl-${level} { background: ${levelBadge[level].bg}; color: ${levelBadge[level].text}; }`;

/** Styles for the shadow root. Nothing here can leak to (or be changed by) the host page. */
export const tooltipCss = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer {
  position: fixed;
  inset: 0;
  width: 0;
  height: 0;
  font-family: ${fontStack};
  color: ${colors.textPrimary};
}
.card {
  position: fixed;
  width: ${card.width}px;
  max-height: ${card.maxHeight}px;
  display: flex;
  flex-direction: column;
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  border-radius: ${card.radius}px;
  box-shadow: ${card.shadow};
  backdrop-filter: blur(${card.blur}px);
  -webkit-backdrop-filter: blur(${card.blur}px);
  font-size: ${typeScale.body.size}px;
  line-height: ${typeScale.body.lineHeight};
  pointer-events: auto;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity ${motion.openMs}ms ease-out, transform ${motion.openMs}ms ease-out;
}
.card.open { opacity: 1; transform: none; }
.card.closing { opacity: 0; transition-duration: ${motion.closeMs}ms; }
.header { padding: ${card.padding}px ${card.padding}px ${spacing.sm}px; }
.title-row { display: flex; align-items: center; gap: ${spacing.sm}px; }
.term {
  flex: 1;
  min-width: 0;
  font-size: ${typeScale.term.size}px;
  font-weight: ${typeScale.term.weight};
  line-height: ${typeScale.term.lineHeight};
  overflow-wrap: anywhere;
}
.meta {
  margin-top: ${spacing.xs}px;
  font-size: ${typeScale.meta.size}px;
  font-weight: ${typeScale.meta.weight};
  line-height: ${typeScale.meta.lineHeight};
  color: ${colors.textSecondary};
}
.body {
  padding: ${spacing.sm}px ${card.padding}px ${spacing.md}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing.md}px;
  border-top: 1px solid ${colors.border};
  border-bottom: 1px solid ${colors.border};
}
.section-label {
  margin-bottom: ${spacing.xs}px;
  font-size: ${typeScale.label.size}px;
  font-weight: ${typeScale.label.weight};
  line-height: ${typeScale.label.lineHeight};
  letter-spacing: ${typeScale.label.letterSpacing};
  text-transform: uppercase;
  color: ${colors.textSecondary};
}
.example { font-style: italic; color: ${colors.textSecondary}; }
.simpler { font-size: ${typeScale.meta.size}px; color: ${colors.textSecondary}; }
.error-text { color: ${colors.error}; }
.muted { color: ${colors.textSecondary}; font-size: ${typeScale.meta.size}px; }
.fade { animation: sve-fade ${motion.openMs}ms ease-out; }
@keyframes sve-fade { from { opacity: 0; } to { opacity: 1; } }

.badge {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: ${typeScale.meta.size}px;
  font-weight: 700;
  white-space: nowrap;
}
${badge('A1')}
${badge('A2')}
${badge('B1')}
${badge('B2')}
${badge('C1')}
${badge('C2')}

.icon-btn {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${colors.textSecondary};
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}
.icon-btn:hover { background: ${colors.surfaceRaised}; color: ${colors.textPrimary}; }
.icon-btn.active { color: ${colors.accent}; }
.btn {
  height: ${button.height}px;
  padding: 0 ${button.paddingX}px;
  border: 1px solid ${colors.border};
  border-radius: ${button.radius}px;
  background: ${colors.surfaceRaised};
  color: ${colors.textPrimary};
  font: inherit;
  font-size: ${typeScale.button.size}px;
  font-weight: ${typeScale.button.weight};
  cursor: pointer;
}
.btn:hover:not(:disabled) { border-color: ${colors.accent}; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn.saved { color: ${colors.success}; border-color: ${colors.success}; }
.btn.link { height: auto; padding: 0; border: 0; background: none; color: ${colors.accent}; }
button:focus-visible { outline: 2px solid ${colors.accent}; outline-offset: 2px; }

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm}px;
  padding: ${spacing.md}px ${card.padding}px;
}
.hint { font-size: ${typeScale.meta.size}px; color: ${colors.textSecondary}; }
.idiom-tag { color: ${colors.idiom}; }

.nudge {
  display: flex;
  align-items: flex-start;
  gap: ${spacing.sm}px;
  padding: ${spacing.sm}px ${spacing.md}px;
  border: 1px solid ${colors.border};
  border-radius: ${button.radius}px;
  background: ${colors.surfaceRaised};
  font-size: ${typeScale.meta.size}px;
  color: ${colors.textSecondary};
}
.nudge .grow { flex: 1; }

.skeleton { display: flex; flex-direction: column; gap: ${spacing.sm}px; }
.bar {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(90deg, ${colors.skeletonFrom}, ${colors.skeletonTo}, ${colors.skeletonFrom});
  background-size: 200% 100%;
  animation: sve-shimmer 1.2s linear infinite;
}
@keyframes sve-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.w100 { width: 100%; }
.w85 { width: 85%; }
.w60 { width: 60%; }

.toast {
  position: fixed;
  padding: 6px 12px;
  border-radius: 999px;
  background: ${colors.surface};
  border: 1px solid ${colors.border};
  color: ${colors.textPrimary};
  font-size: ${typeScale.meta.size}px;
  font-weight: ${typeScale.meta.weight};
  pointer-events: none;
  opacity: 0;
  transition: opacity ${motion.toastFadeMs}ms ease-out;
}
.toast.show { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .card, .card.closing { transition-duration: 0ms; transform: none; }
  .fade, .bar { animation: none; }
  .toast { transition-duration: 0ms; }
}
`.trim();
