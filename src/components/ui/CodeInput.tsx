import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@/constants/room';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

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
  const { colors } = useTheme();
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
            { backgroundColor: colors.card, borderColor: colors.line },
            i === activeIndex && !error && { borderColor: colors.acc },
            error && { borderColor: colors.neg },
          ]}
        >
          <Text style={[textStyle('roomCode', { fontSize: 32 }), { color: colors.ink }]}>{chars[i] ?? ''}</Text>
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
