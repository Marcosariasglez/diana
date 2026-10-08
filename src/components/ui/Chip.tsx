import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export type ChipVariant = 'default' | 'accent' | 'white' | 'outline';

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: LucideIcon;
  accessibilityLabel?: string;
}

/** Insignia A3.4: píldora; neutra card con sombra; positiva accSoft+acc. */
export function Chip({ label, variant = 'default', icon: Icon, accessibilityLabel }: ChipProps) {
  const { colors, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const fg = {
    default: colors.ink,
    accent: colors.acc,
    white: colors.ink,
    outline: colors.ink,
  }[variant];
  const styles = useThemedStyles((c) => {
    const v = {
      default: { bg: c.chip, border: 'transparent' as const },
      accent: { bg: c.accSoft, border: 'transparent' as const },
      white: { bg: c.card, border: 'transparent' as const },
      outline: { bg: 'transparent' as const, border: c.line },
    }[variant];
    return StyleSheet.create({
      chip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 99,
        borderWidth: 1,
        backgroundColor: v.bg,
        borderColor: v.border,
      },
      text: { color: fg },
    });
  });

  const showShadow = !isDark && variant === 'white';

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.chip, showShadow && SHADOWS.card]}
    >
      {Icon ? <Icon size={14} color={fg} strokeWidth={2} /> : null}
      <Text style={[textStyle('bodySmall', { fontSize: 12, fontFamily: 'Inter-SemiBold' }), styles.text]}>{label}</Text>
    </View>
  );
}
