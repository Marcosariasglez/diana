import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Tv } from 'lucide-react-native';
import { FeaturedMatchCard } from '@/components/features/FeaturedMatchCard';
import { PosterCarousel } from '@/components/features/PosterCarousel';
import { EmptyState, ErrorState, PillGroup, Screen, Skeleton } from '@/components/ui';
import { BOTTOM_NAV_HEIGHT } from '@/components/ui/BottomNav';
import { PLATFORMS } from '@/constants/platforms';
import { useFeedData } from '@/features/feed/useFeedData';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { FeedCategory, Media } from '@/types/media';

const CATEGORY_TITLES: Record<FeedCategory['id'], string> = {
  'hidden-gems': 'Joyas ocultas',
  recommendations: 'Recomendaciones',
};

const PLATFORM_ITEMS = PLATFORMS.map((p) => ({ label: p.name, value: p.id }));
const NEAR_END = 240;

function FeedSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Cargando tu feed">
      <Skeleton width="100%" height={300} radius={16} />
      {[0, 1].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={160} height={22} />
          <View style={styles.skeletonPosters}>
            <Skeleton width={120} height={180} radius={12} />
            <Skeleton width={120} height={180} radius={12} />
            <Skeleton width={120} height={180} radius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const feed = useFeedData();
  const { featured, categories, status, platforms } = feed;

  const openDetail = useCallback(
    (media: Media) =>
      router.push({
        pathname: '/detail/[id]',
        params: { id: String(media.id), type: media.media_type },
      }),
    [router],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END) {
      void feed.loadMore();
    }
  };

  const noPlatforms = platforms.length === 0;
  const loading = !noPlatforms && (status === 'idle' || status === 'loading');
  const ready = !noPlatforms && status !== 'idle' && status !== 'loading' && !feed.fatalError;
  const nothing = ready && !featured && categories.length === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Para ti
          </Text>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notificaciones"
            style={[styles.bell, SHADOWS.card]}
          >
            <Bell size={22} color={COLORS.textPrimary} fill={COLORS.textPrimary} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillScroll}
          contentContainerStyle={styles.pills}
        >
          <PillGroup
            items={PLATFORM_ITEMS}
            selected={platforms}
            onChange={feed.setPlatforms}
            multiple
            activeColor={COLORS.textPrimary}
          />
        </ScrollView>

        {noPlatforms ? (
          <EmptyState
            icon={Tv}
            title="Elige al menos una plataforma"
            message="Selecciona dónde ves contenido para ver recomendaciones."
          />
        ) : null}

        {loading ? <FeedSkeleton /> : null}

        {feed.fatalError ? (
          <ErrorState message="No pudimos cargar tu feed" onRetry={feed.reload} />
        ) : null}

        {nothing ? (
          <EmptyState
            icon={Tv}
            title="No hay títulos para estas plataformas"
            message="Prueba con otras plataformas."
          />
        ) : null}

        {ready && !nothing ? (
          <View style={styles.sections}>
            {featured ? (
              <View style={styles.featured}>
                <FeaturedMatchCard item={featured} onPress={() => openDetail(featured.media)} />
              </View>
            ) : null}
            {categories.map((cat) => (
              <PosterCarousel
                key={cat.id}
                title={CATEGORY_TITLES[cat.id]}
                items={cat.media}
                onPress={openDetail}
                onSeeAll={() => router.push(`/see-all/${cat.id}`)}
              />
            ))}
            {feed.loadingMore ? (
              <ActivityIndicator
                color={COLORS.accent}
                accessibilityLabel="Cargando más títulos"
                style={styles.spinner}
              />
            ) : null}
            {feed.pageError ? (
              <View style={styles.inlineError}>
                <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>
                  No pudimos cargar más títulos
                </Text>
                <Pressable
                  onPress={() => void feed.retryMore()}
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar"
                  style={styles.retry}
                >
                  <Text style={textStyle('bodySmall', { fontWeight: '700', color: COLORS.accent })}>
                    Reintentar
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: BOTTOM_NAV_HEIGHT + 24, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: textStyle('screenTitle', { fontSize: 34, color: COLORS.textPrimary }),
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillScroll: { flexGrow: 0 },
  pills: { paddingHorizontal: 20, paddingVertical: 4 },
  sections: { gap: 24 },
  featured: { paddingHorizontal: 20 },
  skeleton: { paddingHorizontal: 20, gap: 24 },
  skeletonRow: { gap: 12 },
  skeletonPosters: { flexDirection: 'row', gap: 12 },
  spinner: { paddingVertical: 12 },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 },
});
