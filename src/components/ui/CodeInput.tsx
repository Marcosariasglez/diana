import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@/constants/room';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export const CODE_ERROR_COLOR = '#B42318';

export interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

/** Normaliza: mayusculas, solo caracteres del alfabeto de salas, longitud maxima. */
export function sanitizeRoomCode(text: string, length: number = ROOM_CODE_LENGTH): string {
  return text
    .toUpperCase()
    .split('')
    .filter((c) => ROOM_CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, length);
}

export function CodeInput({ length = ROOM_CODE_LENGTH, value, onChange, error = false }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const chars = value.split('');
  const activeIndex = Math.min(chars.length, length - 1);
  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => inputRef.current?.focus()}
      style={styles.row}
    >
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          testID="code-tile"
          style={[
            styles.tile,
            i === activeIndex && !error && styles.tileActive,
            error && styles.tileError,
          ]}
        >
          <Text style={[textStyle('roomCode', { fontSize: 32 }), styles.char]}>{chars[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        testID="code-input"
        accessibilityLabel={`Código de sala, ${length} caracteres`}
        accessibilityHint={error ? 'El código no es válido' : undefined}
        value={value}
        onChangeText={(t) => onChange(sanitizeRoomCode(t, length))}
        maxLength={length}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  tile: {
    width: 64,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: { borderColor: COLORS.accent },
  tileError: { borderColor: CODE_ERROR_COLOR },
  char: { color: COLORS.textPrimary },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
