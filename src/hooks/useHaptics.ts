import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticKind = 'light' | 'medium' | 'success' | 'warning';

/** Funcion plana (JS thread) para usar con `toJS(haptic)`. En web no hace nada. */
export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  try {
    switch (kind) {
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
    }
  } catch {
    // los hapticos nunca deben romper la interfaz
  }
}

export function useHaptics(): { haptic: (kind?: HapticKind) => void } {
  const fire = useCallback((kind: HapticKind = 'light') => haptic(kind), []);
  return { haptic: fire };
}
