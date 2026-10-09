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
import { selectUnreadCount, useNotificationTrayStore } from '@/store/useNotificationTrayStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { FeedCategory, Media } from '@/types/media';

const CATEGORY_TITLES: Record<FeedCategory['id'], string> = {
  'hidden-gems': 'Joyas ocultas',
  recommendations: 'Recomendaciones',
};

const PLATFORM_ITEMS = PLATFORMS.map((p) => ({ label: p.name, value: p.id }));
const NEAR_END = 240;

const SKELETON_STYLES = StyleSheet.create({
  skeleton: { paddingHorizontal: 20, gap: 24 },
  skeletonRow: { gap: 12 },
  skeletonPosters: { flexDirection: 'row' as const, gap: 12 },
});

function FeedSkeleton() {
  return (
    <View style={SKELETON_STYLES.skeleton} accessibilityLabel="Cargando tu feed">
      <Skeleton width="100%" height={300} radius={16} />
      {[0, 1].map((i) => (
        <View key={i} style={SKELETON_STYLES.skeletonRow}>
          <Skeleton width={160} height={22} />
          <View style={SKELETON_STYLES.skeletonPosters}>
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
  const unread = useNotificationTrayStore(selectUnreadCount);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    content: { paddingTop: 16, paddingBottom: BOTTOM_NAV_HEIGHT + 24, gap: 16 },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 20,
    },
    title: { color: c.ink },
    bell: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    bellBadge: {
      position: 'absolute' as const,
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 4,
    },
    bellBadgeText: { color: c.onAcc, fontSize: 10, lineHeight: 12, fontFamily: 'Inter-SemiBold' },
    pillScroll: { flexGrow: 0 },
    pills: { paddingHorizontal: 20, paddingVertical: 4 },
    sections: { gap: 24 },
    featured: { paddingHorizontal: 20 },
    skeleton: { paddingHorizontal: 20, gap: 24 },
    skeletonRow: { gap: 12 },
    skeletonPosters: { flexDirection: 'row' as const, gap: 12 },
    spinner: { paddingVertical: 12 },
    inlineError: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 12,
    },
    retry: { minHeight: 44, minWidth: 44, justifyContent: 'center' as const, paddingHorizontal: 8 },
  }));

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
          <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
            Para ti
          </Text>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'
            }
            style={[styles.bell, SHADOWS.card]}
          >
            <Bell size={20} color={colors.ink} fill={colors.ink} strokeWidth={2} />
            {unread > 0 ? (
              <View style={[styles.bellBadge, { backgroundColor: colors.acc }]}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
              </View>
            ) : null}
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
            activeColor={colors.ink}
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
                color={colors.acc}
                accessibilityLabel="Cargando más títulos"
                style={styles.spinner}
              />
            ) : null}
            {feed.pageError ? (
              <View style={styles.inlineError}>
                <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
                  No pudimos cargar más títulos
                </Text>
                <Pressable
                  onPress={() => void feed.retryMore()}
                  accessibilityRole="button"
                  accessibilityLabel="Reintentar"
                  style={styles.retry}
                >
                  <Text style={textStyle('bodySmall', { fontFamily: 'Inter-Bold', color: colors.acc })}>
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

