import type { ViewStyle } from 'react-native';

/**
 * Deriva colores con transparencia a partir de tokens (A3.4/X2).
 * p. ej. fondo de la barra inferior = `card` al 92 %, icono en círculo = tono al 16 %.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length >= 8) hex = hex.slice(0, 6); // #RRGGBBAA → RGB
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map((s) => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
  }
  return color;
}

/** Desenfoque para web (X2: barra inferior blur 16, velo blur 3). Solo se aplica en web. */
export function webBlur(px: number): ViewStyle {
  return { backdropFilter: `blur(${px}px)`, WebkitBackdropFilter: `blur(${px}px)` } as unknown as ViewStyle;
}
