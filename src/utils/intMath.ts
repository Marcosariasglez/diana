/** Division entera con redondeo de la mitad alejandose de cero. b > 0. Nunca devuelve -0. */
export function roundDiv(a: number, b: number): number {
  const q = Math.floor(Math.abs(a) / b);
  const r = Math.abs(a) % b;
  const up = 2 * r >= b ? 1 : 0;
  return Math.sign(a) * (q + up) || 0;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));