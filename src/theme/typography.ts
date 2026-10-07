export const TYPOGRAPHY = {
  screenTitle: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 28,
  },
  heroTitle: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 32,
  },
  detailTitle: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 26,
  },
  label: {
    fontFamily: 'Manrope',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.06,
  },
  body: {
    fontFamily: 'Manrope',
    fontWeight: '500',
    fontSize: 16,
  },
  bodySmall: {
    fontFamily: 'Manrope',
    fontWeight: '500',
    fontSize: 14,
  },
  posterTitle: {
    fontFamily: 'Manrope',
    fontWeight: '700',
    fontSize: 13,
  },
  navLabel: {
    fontFamily: 'Manrope',
    fontWeight: '500',
    fontSize: 11,
  },
  wizardQuestion: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 34,
  },
  bestMatch: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 38,
  },
  roomCode: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 46,
  },
  predictionRevealed: {
    fontFamily: 'Manrope',
    fontWeight: '800',
    fontSize: 40,
  },
} as const;


import type { TextStyle } from 'react-native';

export type TypographyName = keyof typeof TYPOGRAPHY;

/**
 * Estilo de texto listo para usar. Convierte el tracking de em a px (RN solo
 * admite px). Manrope es una fuente variable: el peso se pide con fontWeight y
 * el plan B (TTF estaticos) se centralizaria aqui.
 */
export function textStyle(name: TypographyName, overrides?: TextStyle): TextStyle {
  const base: TextStyle = { ...TYPOGRAPHY[name] };
  if (base.letterSpacing !== undefined && base.fontSize !== undefined) {
    base.letterSpacing = base.letterSpacing * base.fontSize;
  }
  return overrides ? { ...base, ...overrides } : base;
}
