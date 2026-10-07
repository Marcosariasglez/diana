import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSettingsStore } from '@/store/useSettingsStore';

export type MotionOverride = 'system' | 'on' | 'off';

/**
 * Devuelve `true` si hay que reducir el movimiento (10.6).
 * - Fuente de verdad: ajuste del sistema (Reanimated + AccessibilityInfo).
 * - `override`: 'on' fuerza reducir, 'off' fuerza animar, 'system' (por
 *   defecto, el valor del store de ajustes) usa el sistema.
 */
export function useMotionPreference(override?: MotionOverride): boolean {
  const stored = useSettingsStore((s) => s.reducedMotion);
  const mode: MotionOverride = override ?? stored;
  const reanimatedReduced = useReducedMotion();
  const [infoReduced, setInfoReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setInfoReduced(value);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setInfoReduced(value);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return Boolean(reanimatedReduced) || infoReduced;
}
