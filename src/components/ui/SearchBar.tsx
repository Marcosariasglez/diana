import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar películas y series',
}: SearchBarProps) {
  return (
    <View accessibilityRole="search" style={styles.bar}>
      <Search size={20} color={COLORS.textSecondary} />
      <TextInput
        accessibilityLabel="Buscar"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        style={[textStyle('body'), styles.input]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <X size={18} color={COLORS.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 26,
    backgroundColor: COLORS.card,
    ...SHADOWS.card,
  },
  input: { flex: 1, color: COLORS.textPrimary, height: 52, padding: 0 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
