import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface RoomCodeTilesProps {
  code: string;
  onCopy?: () => void;
  /** 'neutral' = fichas grises y chip "Copiar código" sin icono (Lobby, wireframe 6). */
  tone?: 'accent' | 'neutral';
}

export function RoomCodeTiles({ code, onCopy, tone = 'accent' }: RoomCodeTilesProps) {
  const { colors } = useTheme();
  const neutral = tone === 'neutral';
  return (
    <View style={styles.wrap}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Código de sala ${code.split('').join(' ')}`}
        style={styles.row}
      >
        {code.split('').map((c, i) => (
          <View
            key={i}
            testID="room-code-tile"
            style={[styles.tile, { backgroundColor: neutral ? colors.chip : colors.accSoft }]}
          >
            <Text style={[textStyle('roomCode'), { color: neutral ? colors.ink : colors.acc }]}>{c}</Text>
          </View>
        ))}
      </View>
      {onCopy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copiar código de sala"
          onPress={onCopy}
          style={[styles.copy, neutral && { backgroundColor: colors.accSoft, borderRadius: 99, paddingHorizontal: 20 }]}
        >
          {neutral ? null : <Copy size={20} color={colors.acc} />}
          <Text
            style={[
              textStyle('bodySmall', { fontFamily: 'Inter-Bold' }),
              { color: colors.acc },
            ]}
          >
            Copiar código
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  tile: {
    width: 72,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
});
