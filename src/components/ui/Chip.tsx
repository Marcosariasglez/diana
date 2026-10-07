import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export type ChipVariant = 'default' | 'accent' | 'white' | 'outline';

export interface ChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: LucideIcon;
  accessibilityLabel?: string;
}

const VARIANTS = {
  default: { bg: COLORS.surfaceNeutral, fg: COLORS.textPrimary, border: 'transparent' },
  accent: { bg: COLORS.accentSoft, fg: COLORS.accentSoftText, border: 'transparent' },
  white: { bg: COLORS.card, fg: COLORS.textPrimary, border: 'transparent' },
  outline: { bg: 'transparent', fg: COLORS.textPrimary, border: COLORS.divider },
} as const;

export function Chip({ label, variant = 'default', icon: Icon, accessibilityLabel }: ChipProps) {
  const v = VARIANTS[variant];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.chip, { backgroundColor: v.bg, borderColor: v.border }]}
    >
      {Icon ? <Icon size={14} color={v.fg} strokeWidth={2} /> : null}
      <Text style={[textStyle('label', { letterSpacing: 0 }), { color: v.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
