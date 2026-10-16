import React from 'react';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Elemento renderizado a la derecha, dentro del contenedor. */
  accessory?: React.ReactNode;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar películas y series',
  accessory,
}: SearchBarProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  return (
    <View
      accessibilityRole="search"
      style={[
        styles.bar,
        { backgroundColor: colors.card, borderColor: focused ? colors.acc : 'transparent' },
      ]}
    >
      <Search size={20} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel="Buscar"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          textStyle('body'),
          { color: colors.ink },
          Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null,
        ]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <X size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      {accessory}
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  input: { flex: 1, minWidth: 0, padding: 0 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
