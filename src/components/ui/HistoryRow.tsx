import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import type { HistoryEntry } from '@/types/rating';
import { EntryPoster } from '@/components/features/EntryPoster';
import { formatRating } from '@/utils/format';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export interface HistoryRowProps {
  entry: HistoryEntry;
  /** Ruta de póster resuelta (D3). Si no se pasa, usa entry.posterPath. */
  posterPath?: string | null;
  onPress?: () => void;
}

export function HistoryRow({ entry, posterPath, onPress }: HistoryRowProps) {
  const { colors } = useTheme();
  const rating = formatRating(entry.userRating);
  const ai = formatRating(entry.aiPrediction);
  const aiLabel = entry.predictionSeen ? `Predicción de IA ${ai}` : 'Predicción bloqueada';
  const resolvedPosterPath = posterPath ?? entry.posterPath ?? null;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${entry.title}, tu nota ${rating}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <EntryPoster
        posterPath={resolvedPosterPath}
        color={entry.posterColor}
        title={entry.title}
        width={40}
        height={58}
        radius={10}
      />
      <Text
        numberOfLines={1}
        style={[textStyle('body', { fontFamily: 'Inter-SemiBold' }), { color: colors.ink }, styles.title]}
      >
        {entry.title}
      </Text>
      <View
        accessible
        accessibilityLabel={`Tu nota ${rating}`}
        style={[styles.chip, { backgroundColor: colors.chip }]}
      >
        <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-Bold', fontVariant: ['tabular-nums'] }), { color: colors.ink }]}>{rating}</Text>
      </View>
      <View accessible accessibilityLabel={aiLabel} style={[styles.chip, { backgroundColor: colors.accSoft }]}>
        {entry.predictionSeen ? (
          <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-Bold', fontVariant: ['tabular-nums'] }), { color: colors.acc }]}>{ai}</Text>
        ) : (
          <Lock testID="history-lock" size={14} color={colors.acc} strokeWidth={2.5} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.85 },
  title: { flex: 1, minWidth: 0 },
  chip: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
