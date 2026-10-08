/**
 * Tokens de color VERTICE (A3.1).
 * Fuente de verdad: VERTICE-README.md Parte A §A3.1.
 *
 * Usa los nombres canónicos tal cual. No añadas colores sueltos en pantallas.
 */

// Palette canonica — claro
export const light = {
  bg: '#F4F3EF',
  card: '#FFFFFF',
  ink: '#15171A',
  onInk: '#F4F3EF',
  mut: '#5A5F68',
  textSecondary: '#5B6068',
  line: '#ECEAE4',
  lineStrong: '#DAD7CE',
  chip: '#EAE8E2',
  acc: '#0B7A66',
  accHover: '#096653',
  accSoft: '#DDF0EA',
  onAcc: '#FFFFFF',
  neg: '#CF4640',
  negBg: 'rgba(207,70,64,.09)',
  warn: '#B7791F',
  warnBg: 'rgba(183,121,31,.09)',
  overlay: 'rgba(10,12,15,.35)',
  c1: '#0B7A66',
  c2: '#3F5BD8',
  c3: '#E2A03A',
  c4: '#C4548D',
  c5: '#9AA1AB',
  c6: '#8E5BD9',
} as const;

// Palette canonica — oscuro
export const dark = {
  bg: '#0A0C0F',
  card: '#14171B',
  ink: '#F2F3F5',
  onInk: '#0A0C0F',
  mut: '#8C939C',
  textSecondary: '#B3B9C1',
  line: '#22262C',
  lineStrong: '#2E333A',
  chip: '#1E2227',
  acc: '#37D6A4',
  accHover: '#5CE3B8',
  accSoft: '#0F3129',
  onAcc: '#03140E',
  neg: '#FF7168',
  negBg: 'rgba(255,113,104,.12)',
  warn: '#F2B85B',
  warnBg: 'rgba(242,184,91,.12)',
  overlay: 'rgba(0,0,0,.6)',
  c1: '#37D6A4',
  c2: '#7C93FF',
  c3: '#F2B85B',
  c4: '#E679B0',
  c5: '#78808B',
  c6: '#B48CFF',
} as const;

export type ThemeColors = typeof light | typeof dark;
export type ThemeName = 'light' | 'dark';

/** Sombra canonical de tarjeta (claro). En oscuro no hay sombra. */
export const shadow =
  '0 1px 2px rgba(20,20,20,.04), 0 6px 24px rgba(20,20,20,.05)';
