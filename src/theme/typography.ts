/**
 * Tipografia VERTICE — Escala exacta Anexo X3.
 *
 * Familias estaticas (no fontWeight suelto):
 *   Manrope-SemiBold / Manrope-Bold / Manrope-ExtraBold
 *   Inter-Regular / Inter-Medium / Inter-SemiBold / Inter-Bold
 *
 * Cifras con tabular-nums.
 */

import type { TextStyle } from 'react-native';

// Tabla X3 — nombres de Diana → especificacion Norte
const TYPOGRAPHY = {
  screenTitle: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 28,
    letterSpacing: -0.03,
  },
  heroTitle: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 32,
    letterSpacing: -0.03,
  },
  detailTitle: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 26,
    letterSpacing: -0.03,
  },
  sectionTitle: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 19,
    letterSpacing: -0.02,
  },
  big: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 46,
    letterSpacing: -0.035,
    fontVariant: ['tabular-nums'],
  },
  value: {
    fontFamily: 'Manrope-Bold',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: 'Inter-Bold',
    fontSize: 12.5,
    letterSpacing: 0.06,
  },
  body: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
  },
  bodyStrong: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  bodySmall: {
    fontFamily: 'Inter-Medium',
    fontSize: 12.5,
  },
  link: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13.5,
  },
  button: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
  },
  posterTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
  },
  navLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10.5,
  },
  wizardQuestion: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 34,
    letterSpacing: -0.03,
  },
  bestMatch: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 38,
    letterSpacing: -0.03,
  },
  roomCode: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 46,
    letterSpacing: 0.12,
    fontVariant: ['tabular-nums'],
  },
  predictionRevealed: {
    fontFamily: 'Manrope-ExtraBold',
    fontSize: 40,
    letterSpacing: -0.03,
    fontVariant: ['tabular-nums'],
  },
} as const;

export type TypographyName = keyof typeof TYPOGRAPHY;

/**
 * Estilo de texto listo para usar. Convierte tracking de em a px.
 * Añade tabular-nums cuando se indique.
 */
export function textStyle(
  name: TypographyName,
  overrides?: TextStyle,
): TextStyle {
  const base = { ...TYPOGRAPHY[name] } as TextStyle;
  if (base.letterSpacing !== undefined && base.fontSize !== undefined) {
    base.letterSpacing = base.letterSpacing * base.fontSize;
  }
  return overrides ? { ...base, ...overrides } : base;
}
