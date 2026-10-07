import { SWIPE_THRESHOLDS } from '@/constants/onboarding';

export type SwipeDir = 'like' | 'skip' | 'unseen';

/**
 * Decide la direccion de un swipe (worklet puro, 10.2).
 * - Eje dominante: horizontal si |tx| >= |ty|.
 * - Horizontal: derecha = like, izquierda = skip.
 * - Vertical: solo hacia arriba = unseen (y solo si allowUnseen).
 */
export function resolveDirection(
  tx: number,
  ty: number,
  vx: number,
  vy: number,
  allowUnseen: boolean = true,
): SwipeDir | null {
  'worklet';
  const distance = SWIPE_THRESHOLDS.distance;
  const velocity = SWIPE_THRESHOLDS.velocity;
  if (Math.abs(tx) >= Math.abs(ty)) {
    if (tx > distance || vx > velocity) return 'like';
    if (tx < -distance || vx < -velocity) return 'skip';
    return null;
  }
  if (allowUnseen && (ty < -distance || vy < -velocity)) return 'unseen';
  return null;
}
