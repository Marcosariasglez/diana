import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Variante con padding 24 (contenido libre). Por defecto: 6 vertical × 16 horizontal (filas). */
  lg?: boolean;
}

/** Tarjeta X2: fondo card, radio 24, sombra `shadow` en claro (ninguna en oscuro). */
export function Card({ children, style, onPress, accessibilityLabel, lg = false }: CardProps) {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const styles = useThemedStyles((c) => ({
    card: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: lg ? 24 : undefined,
      paddingHorizontal: lg ? undefined : 16,
      paddingVertical: lg ? undefined : 6,
    },
    pressed: { opacity: 0.85 },
  }));

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, !isDark && SHADOWS.card, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.card, !isDark && SHADOWS.card, style]}>
      {children}
    </View>
  );
}
