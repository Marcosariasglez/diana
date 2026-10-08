import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export interface ProgressBarProps {
  value: number;
  max: number;
  segments?: number;
  color?: string;
}

export function ProgressBar({ value, max, segments, color }: ProgressBarProps) {
  const { colors } = useTheme();
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const trackColor = color ?? colors.acc;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Progreso"
      accessibilityValue={{ min: 0, max: safeMax, now: Math.min(Math.max(value, 0), safeMax) }}
      style={styles.row}
    >
      {segments && segments > 1 ? (
        Array.from({ length: segments }, (_, i) => {
          const fill = Math.min(1, Math.max(0, ratio * segments - i));
          return (
            <View key={i} testID="progress-segment" style={[styles.track, { backgroundColor: colors.chip }]}>
              <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: trackColor }]} />
            </View>
          );
        })
      ) : (
        <View testID="progress-segment" style={[styles.track, { backgroundColor: colors.chip }]}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: trackColor }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, height: 8 },
  track: { flex: 1, height: 8, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99 },
});
