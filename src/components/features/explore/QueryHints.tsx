import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { pendingHints } from '@/features/explore/parseQueryHints';
import type { ExploreFilters } from '@/features/explore/exploreFilters';

export interface QueryHintsProps {
  query: string;
  filters: ExploreFilters;
  onApply: (hint: string) => void;
}

/** Chips con sugerencias de filtro detectadas en el texto del buscador. Solo visible con query no vacía y hints pendientes. */
export function QueryHints({ query, filters, onApply }: QueryHintsProps) {
  const { colors } = useTheme();
  const hints = query.length > 0 ? pendingHints({ ...filters, query }) : [];

  if (hints.length === 0) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {hints.map((hint) => (
        <Pressable
          key={`${hint.kind}:${hint.value}`}
          accessibilityRole="button"
          accessibilityLabel={`Añadir filtro ${hint.label}`}
          onPress={() => onApply(hint.label)}
          style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.line }]}
        >
          <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), { color: colors.acc }]}>
            +
          </Text>
          <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), { color: colors.ink }]}>
            {hint.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    flexGrow: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    marginRight: 8,
    borderWidth: 1,
  },
});
