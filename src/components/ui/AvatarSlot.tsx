import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export interface AvatarSlotProps {
  initial?: string;
  name?: string;
  occupied?: boolean;
  tone?: 'accent' | 'dark';
  size?: number;
}

export function AvatarSlot({
  initial,
  name,
  occupied = false,
  tone = 'accent',
  size = 60,
}: AvatarSlotProps) {
  const bg = tone === 'accent' ? COLORS.accent : COLORS.textPrimary;
  const label = occupied ? `Participante ${name ?? initial ?? ''}`.trim() : 'Lugar libre';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.wrap}>
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          styles.circle,
          occupied ? { backgroundColor: bg } : styles.empty,
        ]}
      >
        {occupied ? (
          <Text
            style={textStyle('body', { fontWeight: '800', color: '#FFFFFF', fontSize: size * 0.4 })}
          >
            {(initial ?? name ?? '').slice(0, 1).toUpperCase()}
          </Text>
        ) : null}
      </View>
      {name ? (
        <Text numberOfLines={1} style={[textStyle('label', { letterSpacing: 0 }), styles.name]}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surfaceNeutral,
  },
  name: { color: COLORS.textSecondary, maxWidth: 72 },
});
