import type { Config } from 'tailwindcss';
import { colors, fontStack, popupTheme } from './src/shared/tokens';

const config: Config = {
  content: ['./src/popup/**/*.{ts,tsx,html}', './src/onboarding/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        surface: colors.surface,
        'surface-raised': colors.surfaceRaised,
        accent: colors.accent,
        success: colors.success,
        idiom: colors.idiom,
        danger: colors.error,
        'light-bg': popupTheme.light.background,
        'light-text': popupTheme.light.text,
        'light-secondary': popupTheme.light.secondary,
        'light-border': popupTheme.light.border,
        'light-accent': popupTheme.light.accent,
        'dark-bg': popupTheme.dark.background,
        'dark-text': popupTheme.dark.text,
        'dark-secondary': popupTheme.dark.secondary,
      },
      fontFamily: { sans: fontStack.split(', ') },
    },
  },
  plugins: [],
};

export default config;
