import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export type TypeBadgeLabel = 'Película' | 'Serie' | 'Capítulo';

export interface TypeBadgeProps {
  label: TypeBadgeLabel;
}

const PALETTE: Record<TypeBadgeLabel, { bg: string; fg: string }> = {
  Película: { bg: COLORS.textPrimary, fg: '#FFFFFF' },
  Serie: { bg: COLORS.accent, fg: '#FFFFFF' },
  Capítulo: { bg: COLORS.card, fg: COLORS.textPrimary },
};

export function TypeBadge({ label }: TypeBadgeProps) {
  const p = PALETTE[label];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Tipo: ${label}`}
      style={[styles.badge, { backgroundColor: p.bg }]}
    >
      <Text style={[textStyle('label', { color: p.fg, letterSpacing: 0 }), styles.text]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  text: {
    fontSize: 11,
  },
});
