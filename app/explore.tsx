import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ArrowLeft, Film } from 'lucide-react-native';
import { Poster } from '@/components/features/Poster';
import { mediaTitle } from '@/components/features/mediaHelpers';
import { EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { PLATFORMS } from '@/constants/platforms';
import { GENRES } from '@/mocks/data/genres';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';

const PAGE_SIZE = 20;

const DECADES: Array<{ label: string; decade: number | null }> = [
  { label: 'Todas', decade: null },
  { label: 'Años 90', decade: 1990 },
  { label: 'Años 2000', decade: 2000 },
  { label: 'Años 2010', decade: 2010 },
  { label: 'Años 2020', decade: 2020 },
];

const keyOf = (m: Media) => `${m.media_type}-${m.id}`;

function goBack() {
  const r = useRouter();
  if (r.canGoBack()) r.back();
  else r.replace('/');
}

/**
 * VERTICE-PLAN-2 D2-1.6: «Explorar por plataforma». Chips de plataforma →
 * lista paginada infinita (FlashList) que consulta el repositorio paginado
 * (catalog_titles en modo tmdb, memoria en modo mock). Filtros de género y
 * década. El cursor sale de PageResult.nextCursor.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const [platform, setPlatform] = useState<string | null>(null);
  const [genre, setGenre] = useState<number | null>(null);
  const [decade, setDecade] = useState<number | null>(null);

  const [items, setItems] = useState<Media[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<number | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const reqId = useRef(0);

  const fetchPage = useCallback(
    async (nextCursor: number | null) => {
      const id = ++reqId.current;
      busy.current = true;
      try {
        const res = await activeCatalogSource.browse({
          platforms: platform ? [platform] : [],
          genre: genre ?? undefined,
          decade: decade ?? undefined,
          sort: 'popularity',
          cursor: nextCursor ?? 0,
          limit: PAGE_SIZE,
        });
        if (!alive.current || id !== reqId.current) return;
        cursor.current = res.nextCursor;
        setItems((cur) => {
          const seen = new Set(cur.map(keyOf));
          return [...cur, ...res.items.filter((m) => !seen.has(keyOf(m)))];
        });
        setHasMore(res.hasMore);
        setStatus('ready');
      } catch {
        if (alive.current && id === reqId.current) setStatus('error');
      } finally {
        busy.current = false;
        if (alive.current && id === reqId.current) setLoadingMore(false);
      }
    },
    [platform, genre, decade],
  );

  const loadFirst = useCallback(() => {
    setItems([]);
    setStatus('loading');
    cursor.current = null;
    void fetchPage(null);
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
    void fetchPage(cursor.current ?? 0);
  };

  const openDetail = useCallback(
    (media: Media) => router.push({ pathname: '/detail/[id]', params: { id: String(media.id), type: media.media_type } }),
    [router],
  );

  const renderItem: ListRenderItem<Media> = useCallback(
    ({ item }) => (
      <View style={styles.cell}>
        <Poster media={item} size="small" onPress={() => openDetail(item)} />
        <Text numberOfLines={1} style={styles.caption}>
          {mediaTitle(item)}
        </Text>
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
    chipRow: { flexGrow: 0 },
    chipRowContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: c.card,
    },
    chipActive: { backgroundColor: c.accSoft },
    divider: { width: 1, alignSelf: 'stretch' as const, marginHorizontal: 4, backgroundColor: c.line },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
    cell: { width: '33.33%', alignItems: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
    caption: { fontFamily: 'Inter-SemiBold' as const, color: c.ink, fontSize: 11, width: 92, textAlign: 'center' as const },
    list: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 4 },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 24 },
    footer: { paddingVertical: 16 },
    retry: { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  }));

  const chipStyle = (active: boolean) => [styles.chip, active ? styles.chipActive : null, !active && SHADOWS.card];
  const chipText = (active: boolean) =>
    [textStyle('bodySmall', { fontSize: 12, fontFamily: 'Inter-SemiBold' }), { color: active ? colors.acc : colors.ink }];

  const platformChips = useMemo(
    () => [{ id: null as string | null, label: 'Todas' }, ...PLATFORMS.map((p) => ({ id: p.id, label: p.name }))],
    [],
  );
  const genreChips = useMemo(
    () => [{ id: null as number | null, label: 'Todos los géneros' }, ...GENRES.map((g) => ({ id: g.id, label: g.name }))],
    [],
  );

  return (
    <Screen safe={false}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={textStyle('screenTitle', { color: colors.ink })}>
          Explorar
        </Text>
      </View>

      {/* Chips de plataforma (D2-1.6) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {platformChips.map((p) => (
          <Pressable
            key={p.id ?? 'all'}
            testID={`explore-platform-${p.id ?? 'all'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: platform === p.id }}
            onPress={() => setPlatform(p.id)}
            style={chipStyle(platform === p.id)}
          >
            <Text style={chipText(platform === p.id)}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Filtros de género y década */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {genreChips.map((g) => (
          <Pressable
            key={g.id ?? 'allg'}
            accessibilityRole="button"
            accessibilityState={{ selected: genre === g.id }}
            onPress={() => setGenre(g.id)}
            style={chipStyle(genre === g.id)}
          >
            <Text style={chipText(genre === g.id)}>{g.label}</Text>
          </Pressable>
        ))}
        <View style={styles.divider} />
        {DECADES.map((d) => (
          <Pressable
            key={d.label}
            accessibilityRole="button"
            accessibilityState={{ selected: decade === d.decade }}
            onPress={() => setDecade(d.decade)}
            style={chipStyle(decade === d.decade)}
          >
            <Text style={chipText(decade === d.decade)}>{d.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {status === 'loading' ? (
        <View style={styles.grid} accessibilityLabel="Cargando títulos">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} width={96} height={144} radius={12} />
          ))}
        </View>
      ) : status === 'error' && items.length === 0 ? (
        <View style={styles.center}>
          <ErrorState message="No se pudo cargar el catálogo" onRetry={loadFirst} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon={Film} title="Nada aquí todavía" message="Prueba con otra plataforma o quita un filtro." />
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
            ) : null
          }
        />
      )}
    </Screen>
  );
}
