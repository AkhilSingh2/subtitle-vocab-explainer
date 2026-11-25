/** Design tokens from docs/03-ux-ui-spec.md §2. The only place these values are defined. */

export const colors = {
  surface: 'rgba(22, 24, 29, 0.96)',
  surfaceRaised: '#1F2229',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F5F7FA',
  textSecondary: '#A9B1BD',
  accent: '#7C9CFF',
  success: '#3DD68C',
  idiom: '#FFB547',
  error: '#FF6B6B',
  hoverBg: 'rgba(124, 156, 255, 0.25)',
  skeletonFrom: 'rgba(255, 255, 255, 0.08)',
  skeletonTo: 'rgba(255, 255, 255, 0.14)',
} as const;

export const levelBadge = {
  A1: { bg: '#2A3B2F', text: '#7FE0A0' },
  A2: { bg: '#2A3B2F', text: '#7FE0A0' },
  B1: { bg: '#1F3D2B', text: '#3DD68C' },
  B2: { bg: '#173B3D', text: '#4FD1C5' },
  C1: { bg: '#2E2547', text: '#A78BFA' },
  C2: { bg: '#3D1F3A', text: '#F472B6' },
} as const;

export const popupTheme = {
  light: {
    background: '#FFFFFF',
    text: '#111318',
    secondary: '#5B6472',
    border: '#E6E8EC',
    accent: '#4F6EF7',
  },
  dark: {
    background: '#16181D',
    text: '#F5F7FA',
    secondary: '#A9B1BD',
    border: 'rgba(255, 255, 255, 0.08)',
    accent: '#7C9CFF',
  },
} as const;

export const fontStack =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const typeScale = {
  term: { size: 20, weight: 600, lineHeight: 1.25 },
  body: { size: 14, weight: 400, lineHeight: 1.5 },
  label: { size: 11, weight: 700, lineHeight: 1.4, letterSpacing: '0.08em' },
  meta: { size: 12, weight: 500, lineHeight: 1.4 },
  button: { size: 13, weight: 600, lineHeight: 1.2 },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const card = {
  width: 340,
  maxHeight: 360,
  radius: 14,
  padding: 16,
  shadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
  blur: 12,
  placementGap: 8,
  viewportMargin: 8,
  controlsClearance: 64,
} as const;

export const button = { height: 32, radius: 8, paddingX: 12 } as const;

export const motion = { openMs: 120, closeMs: 80, hoverMs: 80, toastVisibleMs: 1200, toastFadeMs: 200 } as const;

export const zIndexMax = 2147483647;
