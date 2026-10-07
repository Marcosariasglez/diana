import type { Config } from 'tailwindcss';
import { COLORS } from './src/theme/colors';

export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        screen: COLORS.screenBg,
        card: COLORS.card,
        textPrimary: COLORS.textPrimary,
        textSecondary: COLORS.textSecondary,
        accent: COLORS.accent,
        'accent-soft': COLORS.accentSoft,
        'accent-text': COLORS.accentSoftText,
        surface: COLORS.surfaceNeutral,
        divider: COLORS.divider,
      },
    },
  },
  plugins: [],
} satisfies Config;
