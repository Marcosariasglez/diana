import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface FilterButtonProps {
  count: number;
  onPress: () => void;
}

/** Botón cuadrado 38×38px con icono de filtros y badge de activos. */
export function FilterButton({ count, onPress }: FilterButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filtros, ${count} activos`}
      onPress={onPress}
      style={[styles.button, { backgroundColor: colors.chip }]}
    >
      <SlidersHorizontal size={18} color={colors.ink} />
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.acc }]}>
          <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-Bold' }), { color: colors.onAcc }]}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
