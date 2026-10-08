import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Film } from 'lucide-react-native';
import { Poster } from '@/components/features/Poster';
import { mediaTitle } from '@/components/features/mediaHelpers';
import { EmptyState, ErrorState, LockedAffinityChip, Screen, Skeleton } from '@/components/ui';
import { catalogRepository } from '@/services';
import { getRankingContext } from '@/store/rankingContext';
import { useProfileStore } from '@/store/useProfileStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media, MediaWithAffinity } from '@/types/media';

type CategoryId = 'hidden-gems' | 'recommendations';

const TITLES: Record<CategoryId, string> = {
  'hidden-gems': 'Joyas ocultas',
  recommendations: 'Recomendaciones',
};

const isCategory = (v: string | undefined): v is CategoryId => v === 'hidden-gems' || v === 'recommendations';
const keyOf = (m: MediaWithAffinity) => `${m.media.media_type}-${m.media.id}`;

export default function SeeAllScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = isCategory(raw) ? raw : null;

  const [items, setItems] = useState<MediaWithAffinity[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const page = useRef(0);
  const busy = useRef(false);
  const alive = useRef(true);

  const fetchPage = useCallback(
    async (p: number) => {
      if (!category) return;
      busy.current = true;
      try {
        const platforms = useProfileStore.getState().profile.favoritePlatforms;
        const res = await catalogRepository.getCategoryItems(category, platforms, getRankingContext(), p);
        if (!alive.current) return;
        page.current = p;
        setItems((cur) => {
          const seen = new Set(cur.map(keyOf));
          return [...cur, ...res.items.filter((m) => !seen.has(keyOf(m)))];
        });
        setHasMore(res.hasMore);
        setStatus('ready');
      } catch {
        if (alive.current) setStatus('error');
      } finally {
        busy.current = false;
        if (alive.current) setLoadingMore(false);
      }
    },
    [category],
  );

  const loadFirst = useCallback(() => {
    setItems([]);
    setStatus('loading');
    page.current = 0;
    void fetchPage(0);
  }, [fetchPage]);

  useEffect(() => {
    alive.current = true;
    loadFirst();
    return () => {
      alive.current = false;
    };
  }, [loadFirst]);

  const loadMore = () => {
    if (busy.current || !hasMore || status !== 'ready') return;
    setLoadingMore(true);
    void fetchPage(page.current + 1);
  };

  const openDetail = useCallback(
    (media: Media) =>
      router.push({
        pathname: '/detail/[id]',
        params: { id: String(media.id), type: media.media_type },
      }),
    [router],
  );

  const renderItem: ListRenderItem<MediaWithAffinity> = useCallback(
    ({ item }) => (
      <View style={styles.cell}>
        <Poster media={item.media} size="small" onPress={() => openDetail(item.media)} />
        <Text numberOfLines={1} style={styles.caption}>
          {mediaTitle(item.media)}
        </Text>
        {item.bucket === 'bajo' ? null : <LockedAffinityChip bucket={item.bucket} locked />}
      </View>
    ),
    [openDetail],
  );

  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    center: { flex: 1, justifyContent: 'center' as const },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, paddingHorizontal: 20 },
    list: { paddingHorizontal: 12, paddingBottom: 32 },
    cell: { alignItems: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
    caption: { fontFamily: 'Inter-SemiBold' as const, color: c.ink, width: 96 },
    footer: { paddingVertical: 16 },
    retry: { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  }));

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={textStyle('screenTitle', { color: colors.ink })}>
          {category ? TITLES[category] : 'Ver todo'}
        </Text>
      </View>

      {!category ? (
        <View style={styles.center}>
          <EmptyState icon={Film} title="Esta categoría no existe" />
        </View>
      ) : status === 'loading' ? (
        <View style={styles.grid} accessibilityLabel="Cargando títulos">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} width={96} height={144} radius={12} />
          ))}
        </View>
      ) : status === 'error' && items.length === 0 ? (
        <View style={styles.center}>
          <ErrorState message="No pudimos cargar esta categoría" onRetry={loadFirst} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon={Film} title="No hay títulos en esta categoría" />
        </View>
      ) : (
        <FlashList
          data={items}
          numColumns={3}
          renderItem={renderItem}
          keyExtractor={keyOf}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.acc} accessibilityLabel="Cargando más títulos" style={styles.footer} />
            ) : status === 'error' ? (
              <Pressable
                onPress={loadMore}
                accessibilityRole="button"
                accessibilityLabel="Reintentar"
                style={styles.retry}
              >
                <Text style={textStyle('bodySmall', { fontFamily: 'Inter-Bold', color: colors.acc })}>Reintentar</Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
