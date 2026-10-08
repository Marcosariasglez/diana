import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface PillProps {
  label: string;
  active?: boolean;
  /** Fondo de la pildora activa; por defecto token ink. */
  activeColor?: string;
  onPress?: () => void;
}

/** Chip de filtro X2: píldora, neutro = card con sombra, activo = ink/onInk, 13.5/600. */
export function Pill({ label, active = false, activeColor, onPress }: PillProps) {
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      pill: {
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 18,
        borderRadius: 99,
        alignItems: 'center',
        justifyContent: 'center',
      },
      active: { backgroundColor: activeColor ?? c.ink },
      inactive: { backgroundColor: c.card },
      textActive: { color: activeColor ? c.onAcc : c.onInk },
      textInactive: { color: c.ink },
    }),
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.pill, !isDark && SHADOWS.card, active ? styles.active : styles.inactive]}
    >
      <Text
        style={[
          textStyle('link'),
          active ? styles.textActive : styles.textInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
