import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Button } from '@/components/ui/Button';
import { LockedAffinityChip } from '@/components/ui/LockedAffinityChip';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { AffinityBucket, FeedItem, Media } from '@/types/media';
import { formatRuntime } from '@/utils/format';
import { mediaTitle, mediaYear, posterUri } from '../mediaHelpers';
import { Poster } from '../Poster';
import { ReasonLine } from '../ReasonLine';
import { WatchlistButton } from '../WatchlistButton';
import { backdropUri } from './backdrop';

export interface HeroCardProps {
  item: FeedItem;
  /** Posición en el carrusel (0-based) y total, para el label de accesibilidad. */
  index: number;
  total: number;
  width: number;
  height: number;
  onPress: (media: Media) => void;
  /** Texto superior. Por defecto «PARA TI». */
  eyebrow?: string;
}

const BUCKET_LABEL: Record<AffinityBucket, string> = {
  alto: 'Match alto',
  medio: 'Match medio',
  bajo: 'Match bajo',
};

/** «2022 · Drama · 1h 42m» (series: duración típica del capítulo). */
export function heroMeta(media: Media): string {
  const parts: string[] = [];
  const year = mediaYear(media);
  if (Number.isFinite(year) && year > 0) parts.push(String(year));
  if (media.genres[0]) parts.push(media.genres[0].name);
  const minutes = media.media_type === 'movie' ? media.runtime : (media.episode_run_time[0] ?? 0);
  if (minutes > 0) parts.push(formatRuntime(minutes));
  return parts.join(' · ');
}

/** Razón visible: la calculada (`reason`) o, si falta, la 1ª explicación del RPC. */
export function heroReasonText(item: FeedItem): string | undefined {
  const text = item.reason?.text ?? item.explanation?.[0];
  return text?.trim() ? text.trim() : undefined;
}

export function HeroCard({ item, index, total, width, height, onPress, eyebrow = 'PARA TI' }: HeroCardProps) {
  const { colors } = useTheme();
  const { media, bucket } = item;
  const title = mediaTitle(media);
  const why = heroReasonText(item);
  const backdrop = backdropUri(media.backdrop_path);
  const hasPoster = posterUri(media.poster_path) !== null;
  return (
    <View
      style={[styles.card, { width, height, backgroundColor: colors.card }]}
      accessible={false}
    >
      <Pressable
        onPress={() => onPress(media)}
        accessibilityRole="button"
        accessibilityLabel={`${eyebrow === 'PARA TI' ? 'Para ti' : eyebrow}, ${index + 1} de ${total}: ${title}. ${BUCKET_LABEL[bucket]}, nota de IA oculta${why ? `, ${why}` : ''}`}
        style={StyleSheet.absoluteFill}
      >
        {backdrop ? (
          <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        ) : hasPoster ? (
          <View style={styles.posterWrap}>
            <Poster media={media} size="giant" hideTitle />
          </View>
        ) : null}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.25" stopColor={colors.card} stopOpacity={0} />
              <Stop offset="0.8" stopColor={colors.card} stopOpacity={0.96} />
              <Stop offset="1" stopColor={colors.card} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </Pressable>

      <View style={styles.content} pointerEvents="box-none">
        <Text style={[textStyle('label'), { color: colors.textSecondary }]} accessibilityElementsHidden>
          {eyebrow}
        </Text>
        <Text numberOfLines={2} style={textStyle('heroTitle', { color: colors.ink })} accessibilityElementsHidden>
          {title}
        </Text>
        <Text style={textStyle('bodySmall', { color: colors.textSecondary })} accessibilityElementsHidden>
          {heroMeta(media)}
        </Text>
        <ReasonLine reason={why} />
        {bucket === 'bajo' ? null : (
          <View style={styles.chipRow}>
            <LockedAffinityChip bucket={bucket} locked />
          </View>
        )}
        <View style={styles.actions}>
          <Button label="Ver ficha" onPress={() => onPress(media)} accessibilityLabel={`Ver ficha de ${title}`} style={styles.primary} />
          <WatchlistButton mediaType={media.media_type} mediaId={media.id} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden' },
  posterWrap: { alignItems: 'center', paddingTop: 16 },
  content: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 6 },
  chipRow: { flexDirection: 'row' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  primary: { flex: 1 },
});
