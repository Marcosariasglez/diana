import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
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
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.acc : colors.ink;
  const fg = tone === 'accent' ? colors.onAcc : colors.onInk;
  const label = occupied ? `Participante ${name ?? initial ?? ''}`.trim() : 'Lugar libre';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.wrap}>
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          styles.circle,
          occupied ? { backgroundColor: bg } : { borderWidth: 2, borderStyle: 'dashed' as const, borderColor: colors.line, backgroundColor: colors.chip },
        ]}
      >
        {occupied ? (
          <Text
            style={textStyle('body', { fontFamily: 'Manrope-ExtraBold', color: fg, fontSize: size * 0.4 })}
          >
            {(initial ?? name ?? '').slice(0, 1).toUpperCase()}
          </Text>
        ) : null}
      </View>
      {name ? (
        <Text numberOfLines={1} style={[textStyle('label', { letterSpacing: 0 }), { color: colors.textSecondary, maxWidth: 72 }]}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  circle: { alignItems: 'center', justifyContent: 'center' },
});
