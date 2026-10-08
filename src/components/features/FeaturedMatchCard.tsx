import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flame, Lock } from 'lucide-react-native';
import { platformName } from '@/constants/platforms';
import { useTheme } from '@/theme/ThemeProvider';
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
  const { colors } = useTheme();
  const { media, bucket } = item;
  const title = mediaTitle(media);
  const platform = media.platforms[0];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${eyebrow}: ${title}. ${BUCKET_LABEL[bucket]}, nota de IA oculta`}
      style={[styles.card, { backgroundColor: colors.card }]}
    >
      <View style={[styles.badge, { backgroundColor: colors.accSoft }]} accessibilityElementsHidden importantForAccessibility="no">
        <Flame size={16} color={colors.acc} strokeWidth={2.25} />
        <Text style={textStyle('bodySmall', { color: colors.acc, fontFamily: 'Inter-Bold' })}>
          {badge}
        </Text>
      </View>
      <View style={styles.row}>
        <Poster media={media} size="large" />
        <View style={styles.info}>
          <View>
            <Text
              numberOfLines={2}
              style={[textStyle('label'), { color: colors.textSecondary, textTransform: 'uppercase' as const, marginBottom: 8 }]}
            >
              {eyebrow}
            </Text>
            <Text style={textStyle('body', { fontFamily: 'Manrope-Bold', color: colors.ink })}>
              {mediaMeta(media)}
            </Text>
            {platform ? (
              <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
                {platformName(platform)}
              </Text>
            ) : null}
          </View>
          <View>
            <Text
              style={textStyle('body', {
                fontFamily: 'Manrope-ExtraBold',
                color: bucket === 'alto' ? colors.acc : colors.ink,
              })}
            >
              {BUCKET_LABEL[bucket]}
            </Text>
            <View style={styles.lockRow}>
              <Lock size={14} color={colors.textSecondary} strokeWidth={2} />
              <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
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
    borderRadius: 24,
    padding: 12,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
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
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});
