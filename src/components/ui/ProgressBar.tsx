import { StyleSheet, View } from 'react-native';
import { COLORS } from '@/theme/colors';

export interface ProgressBarProps {
  value: number;
  max: number;
  segments?: number;
  color?: string;
}

export function ProgressBar({ value, max, segments, color = COLORS.accent }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
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
            <View key={i} testID="progress-segment" style={styles.track}>
              <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
            </View>
          );
        })
      ) : (
        <View testID="progress-segment" style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, height: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.divider, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
