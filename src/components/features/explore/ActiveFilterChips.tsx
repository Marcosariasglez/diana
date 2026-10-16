import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { activeCount, toChips, type ExploreFilters } from '@/features/explore/exploreFilters';

export interface ActiveFilterChipsProps {
  filters: ExploreFilters;
  onRemove: (type: string, value: string | number) => void;
  onClear: () => void;
}

/** Fila horizontal de chips activos con opción de quitar individual o limpiar todo. */
export function ActiveFilterChips({ filters, onRemove, onClear }: ActiveFilterChipsProps) {
  const { colors } = useTheme();
  const chips = toChips(filters);
  const count = activeCount(filters);

  if (count === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {chips.map((chip) => (
          <Pressable
            key={chip.key}
            accessibilityRole="button"
            accessibilityLabel={`Quitar filtro ${chip.label}`}
            onPress={() => onRemove(chip.kind, chip.value)}
            style={[styles.chip, { backgroundColor: colors.accSoft, borderColor: colors.accSoft }]}
          >
            <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), { color: colors.acc }]}>
              {chip.label}
            </Text>
            <X size={12} color={colors.acc} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpiar todos los filtros"
          onPress={onClear}
          style={styles.clearButton}
        >
          <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), { color: colors.acc }]}>
            Limpiar
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  scroll: {
    flexGrow: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    marginRight: 8,
  },
  clearButton: {
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
});
