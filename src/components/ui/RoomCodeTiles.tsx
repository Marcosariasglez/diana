import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export interface RoomCodeTilesProps {
  code: string;
  onCopy?: () => void;
  /** 'neutral' = fichas grises y chip "Copiar código" sin icono (Lobby, wireframe 6). */
  tone?: 'accent' | 'neutral';
}

export function RoomCodeTiles({ code, onCopy, tone = 'accent' }: RoomCodeTilesProps) {
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
            style={[styles.tile, neutral && styles.tileNeutral]}
          >
            <Text style={[textStyle('roomCode'), styles.char, neutral && styles.charNeutral]}>{c}</Text>
          </View>
        ))}
      </View>
      {onCopy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copiar código de sala"
          onPress={onCopy}
          style={[styles.copy, neutral && styles.copyChip]}
        >
          {neutral ? null : <Copy size={20} color={COLORS.accent} />}
          <Text
            style={[
              textStyle('bodySmall', { fontWeight: '700' }),
              { color: neutral ? COLORS.accentSoftText : COLORS.accent },
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
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileNeutral: { width: 66, backgroundColor: COLORS.surfaceNeutral },
  char: { color: COLORS.accentSoftText },
  charNeutral: { color: COLORS.textPrimary },
  copyChip: { backgroundColor: COLORS.accentSoft, borderRadius: 22, paddingHorizontal: 20 },
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
