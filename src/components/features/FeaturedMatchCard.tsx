import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flame, Lock } from 'lucide-react-native';
import { platformName } from '@/constants/platforms';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { AffinityBucket, MediaWithAffinity } from '@/types/media';
import { mediaMeta, mediaTitle } from './mediaHelpers';
import { Poster } from './Poster';

export interface FeaturedMatchCardProps {
  item: MediaWithAffinity;
  /** Texto superior lateral. Por defecto "MEJOR MATCH ESTA NOCHE". */
  eyebrow?: string;
  /** Texto del badge verde. Por defecto "Recomendación Top". */
  badge?: string;
  onPress?: () => void;
}

const BUCKET_LABEL: Record<AffinityBucket, string> = {
  alto: 'Match alto',
  medio: 'Match medio',
  bajo: 'Match bajo',
};

export function FeaturedMatchCard({
  item,
  eyebrow = 'MEJOR MATCH ESTA NOCHE',
  badge = 'Recomendación Top',
  onPress,
}: FeaturedMatchCardProps) {
  const { media, bucket } = item;
  const title = mediaTitle(media);
  const platform = media.platforms[0];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${eyebrow}: ${title}. ${BUCKET_LABEL[bucket]}, nota de IA oculta`}
      style={[styles.card, SHADOWS.card]}
    >
      <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no">
        <Flame size={16} color="#FFFFFF" strokeWidth={2.25} />
        <Text style={textStyle('bodySmall', { color: '#FFFFFF', fontWeight: '700' })}>
          {badge}
        </Text>
      </View>
      <View style={styles.row}>
        <Poster media={media} size="large" />
        <View style={styles.info}>
          <View>
            <Text
              numberOfLines={2}
              style={[textStyle('label', { color: COLORS.textSecondary }), styles.eyebrow]}
            >
              {eyebrow}
            </Text>
            <Text style={textStyle('body', { fontWeight: '700', color: COLORS.textPrimary })}>
              {mediaMeta(media)}
            </Text>
            {platform ? (
              <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>
                {platformName(platform)}
              </Text>
            ) : null}
          </View>
          <View>
            <Text
              style={textStyle('body', {
                fontWeight: '800',
                color: bucket === 'alto' ? COLORS.accent : COLORS.textPrimary,
              })}
            >
              {BUCKET_LABEL[bucket]}
            </Text>
            <View style={styles.lockRow}>
              <Lock size={14} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>
                Nota IA oculta
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    minHeight: 32,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});
