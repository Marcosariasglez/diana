import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface PillProps {
  label: string;
  active?: boolean;
  /** Fondo de la pildora activa; por defecto COLORS.accent. */
  activeColor?: string;
  onPress?: () => void;
}

export function Pill({ label, active = false, activeColor, onPress }: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.pill,
        active ? styles.active : styles.inactive,
        active && activeColor ? { backgroundColor: activeColor } : null,
      ]}
    >
      <Text
        style={[
          textStyle('bodySmall', { fontWeight: '600' }),
          { color: active ? '#FFFFFF' : COLORS.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: COLORS.accent },
  inactive: { backgroundColor: COLORS.card, ...SHADOWS.card },
});
