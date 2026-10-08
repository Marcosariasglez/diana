import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { EpisodePicker } from '@/components/features/EpisodePicker';
import { MetricCard } from '@/components/features/MetricCard';
import { SlotReveal } from '@/components/features/SlotReveal';
import { platformName } from '@/constants/platforms';
import { StarRating } from '@/components/features/StarRating';
import { mediaMeta, mediaTitle, mediaYear, posterUri } from '@/components/features/mediaHelpers';
import { Button, ErrorState, Screen, Skeleton } from '@/components/ui';
import { parseDetailParams, valoringLabel, type DetailParams } from '@/features/detail/detailParams';
import { useDetailData, useDetailMedia } from '@/features/detail/useDetailData';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';
import { formatRating, formatRuntime } from '@/utils/format';
import { posterColor } from '@/utils/posterColor';

const HEADER_HEIGHT = 250;
const FOOTER_BOTTOM_GAP = 36;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function BackButton({ inkColor, cardColor }: { inkColor: string; cardColor: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      style={[
        { position: 'absolute' as const, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: cardColor, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 5 },
        SHADOWS.card,
        { top: insets.top + 20 },
      ]}
    >
      <ChevronLeft size={20} color={inkColor} strokeWidth={2} />
    </Pressable>
  );
}

function metaLine(media: Media): string {
  const parts: string[] = [];
  const year = mediaYear(media);
  if (Number.isFinite(year) && year > 0) parts.push(String(year));
  if (media.media_type === 'tv') {
    const n = media.seasons.length;
    if (n > 0) parts.push(`${n} ${n === 1 ? 'temporada' : 'temporadas'}`);
  } else if (media.runtime > 0) {
    parts.push(formatRuntime(media.runtime));
  }
  const genre = media.genres[0]?.name;
  if (genre) parts.push(genre);
  return parts.length > 0 ? parts.join(' · ') : mediaMeta(media);
}

const SKELETON_STYLES = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  skeletonCards: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
});

function DetailSkeleton() {
  return (
    <Screen safe={false}>
      <View testID="detail-skeleton" accessibilityLabel="Cargando ficha" accessibilityRole="progressbar">
        <Skeleton width="100%" height={HEADER_HEIGHT} radius={0} />
        <View style={[SKELETON_STYLES.body]}>
          <Skeleton width="60%" height={32} />
          <Skeleton width="80%" height={18} />
          <Skeleton width="100%" height={44} radius={22} />
          <View style={SKELETON_STYLES.skeletonCards}>
            <Skeleton width="48%" height={148} radius={16} />
            <Skeleton width="48%" height={148} radius={16} />
          </View>
        </View>
      </View>
      <BackButton inkColor={FALLBACK_COLORS.inkColor} cardColor={FALLBACK_COLORS.cardColor} />
    </Screen>
  );
}

import { light } from '@/theme/tokens';

const FALLBACK_COLORS = { inkColor: light.ink, cardColor: light.card };

function DetailContent({ media, params }: { media: Media; params: DetailParams }) {
  const data = useDetailData(media, params);
  const { state, view } = data;
  const title = mediaTitle(media);
  const isTv = media.media_type === 'tv';
  const imageUri = posterUri(media.backdrop_path ?? media.poster_path);
  const [imageFailed, setImageFailed] = useState(false);
  const platform = media.platforms[0];
  const chipLabel = `${isTv ? 'Serie' : 'Película'}${platform ? ` · ${platformName(platform)}` : ''}`;
  const insets = useSafeAreaInsets();
  const rolling = state.phase === 'rolling';
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    flex: { flex: 1 },
    scrollContent: { paddingBottom: 16 },
    header: { height: HEADER_HEIGHT, width: '100%' },
    back: {
      position: 'absolute' as const,
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      zIndex: 5,
    },
    typeChip: {
      position: 'absolute' as const,
      right: 20,
      minHeight: 32,
      paddingHorizontal: 16,
      borderRadius: 99,
      backgroundColor: c.card,
      justifyContent: 'center' as const,
    },
    body: { paddingHorizontal: 20, paddingTop: 20, gap: 6 },
    title: { color: c.ink },
    meta: { color: c.textSecondary },
    picker: { marginTop: 12 },
    valuing: { color: c.textSecondary, paddingHorizontal: 20, marginTop: 8 },
    cards: { flexDirection: 'row' as const, gap: 12, paddingHorizontal: 20, marginTop: 12 },
    skeletonCards: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
    rate: { paddingHorizontal: 20, marginTop: 16 },
    footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: FOOTER_BOTTOM_GAP },
    center: { flex: 1, justifyContent: 'center' as const },
  }));

  return (
    <Screen safe={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: posterColor(media.id) }]}>
          {imageUri && !imageFailed ? (
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImageFailed(true)}
              accessible={false}
            />
          ) : null}
          <View
            accessible
            accessibilityLabel={chipLabel}
            style={[styles.typeChip, { top: insets.top + 28 }]}
          >
            <Text
              style={textStyle('label', {
                color: colors.acc,
                fontSize: 14,
                letterSpacing: 0,
                fontFamily: 'Manrope-Bold',
              })}
            >
              {chipLabel}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text accessibilityRole="header" style={[textStyle('detailTitle'), styles.title]}>
            {title}
          </Text>
          <Text style={[textStyle('body'), styles.meta]}>{metaLine(media)}</Text>
        </View>

        {isTv ? (
          <View style={styles.picker}>
            <EpisodePicker
              seasons={media.seasons}
              season={data.season}
              episode={data.episode}
              onChange={data.setSelection}
            />
          </View>
        ) : null}

        {isTv ? (
          <Text style={[textStyle('bodySmall'), styles.valuing]}>
            {`Valorando: ${valoringLabel(data.season, data.episode)}`}
          </Text>
        ) : null}

        <View style={styles.cards}>
          <MetricCard
            title="Tu nota"
            value={formatRating(state.draft)}
            unit="/ 5"
            topBorderColor={colors.ink}
          >
            <StarRating value={state.draft} onChange={rolling ? undefined : data.setRating} compact size={26} />
          </MetricCard>
          <SlotReveal
            value={data.slotValue}
            state={state.phase}
            animated={state.animated}
            onRevealed={data.onRevealed}
            lockedHint={view.lockedHint}
          />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Button label={view.buttonLabel} disabled={view.buttonDisabled} onPress={data.onPrimaryPress} />
      </View>
      <BackButton inkColor={colors.ink} cardColor={colors.card} />
    </Screen>
  );
}

const FALLBACK_STYLES = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' as const },
});

export default function DetailScreen() {
  const raw = useLocalSearchParams<{ id?: string; type?: string; season?: string; episode?: string }>();
  const params = parseDetailParams(raw);
  const load = useDetailMedia(params);

  if (load.status === 'loading') return <DetailSkeleton />;
  if (load.status === 'notFound') {
    return (
      <Screen>
        <View style={FALLBACK_STYLES.center}>
          <ErrorState message="Este título no existe" retryLabel="Volver" onRetry={goBack} />
        </View>
      </Screen>
    );
  }
  return <DetailContent key={`${params.type}-${params.id}`} media={load.media} params={params} />;
}
