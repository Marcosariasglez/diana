import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Film, X } from 'lucide-react-native';
import { Poster } from '@/components/features/Poster';
import { mediaTitle } from '@/components/features/mediaHelpers';
import { EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { SearchBar } from '@/components/ui/SearchBar';
import { PLATFORMS } from '@/constants/platforms';
import { GENRES } from '@/constants/genres';
import { useDebounce } from '@/hooks/useDebounce';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';

const PAGE_SIZE = 20;

const DECADES: Array<{ label: string; decade: number | null }> = [
  { label: 'Todas', decade: null },
  { label: '2020', decade: 2020 },
  { label: '2010', decade: 2010 },
  { label: '2000', decade: 2000 },
  { label: '1990', decade: 1990 },
  { label: '1980', decade: 1980 },
  { label: '1970', decade: 1970 },
];

const keyOf = (m: Media) => `${m.media_type}-${m.id}`;

/**
 * VERTICE-PLAN-2 D2-1.6: «Explorar por plataforma». Chips de plataforma →
 * lista paginada infinita (FlashList) que consulta el repositorio paginado
 * (catalog_titles vía PostgREST). Filtros de género, década y créditos
 * (director/actor). El cursor sale de PageResult.nextCursor.
 */
export default function ExploreScreen() {
  const router = useRouter();
  // Filtros multi-select: plataformas y géneros son arrays; década sigue single-select
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [decade, setDecade] = useState<number | null>(null);
  // Buscador
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  // P17: Filtro por créditos (director/actor) — degradación si migración 0024 no desplegada
  const [creditQuery, setCreditQuery] = useState('');
  const debouncedCreditQuery = useDebounce(creditQuery, 350);
  const [items, setItems] = useState<Media[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<number | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const reqId = useRef(0);

  const hasActiveFilters = selectedPlatforms.length > 0 || selectedGenres.length > 0 || decade !== null || debouncedQuery.length > 0 || debouncedCreditQuery.length > 0;

  const clearAllFilters = useCallback(() => {
    setSelectedPlatforms([]);
    setSelectedGenres([]);
    setDecade(null);
    setQuery('');
    setCreditQuery('');
  }, []);

  const togglePlatform = useCallback((id: string) => {
    setSelectedPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }, []);

  const toggleGenre = useCallback((id: number) => {
    setSelectedGenres((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  }, []);

  const fetchPage = useCallback(
    async (nextCursor: number | null) => {
      const id = ++reqId.current;
      busy.current = true;
      try {
        const source = activeCatalogSource;
        const res = debouncedQuery.length > 0
          ? await source.search({
              query: debouncedQuery,
              platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
              cursor: nextCursor ?? 0,
              limit: PAGE_SIZE,
            })
          : await source.browse({
              platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
              decade: decade ?? undefined,
              sort: 'popularity',
              cursor: nextCursor ?? 0,
              limit: PAGE_SIZE,
            });
        if (!alive.current || id !== reqId.current) return;
        // Filtrar por géneros en cliente (el backend solo soporta género único)
        const filtered = selectedGenres.length > 0
          ? res.items.filter((m) => m.genres.some((g) => selectedGenres.includes(g.id)))
          : res.items;
        cursor.current = res.nextCursor;
        setItems((cur) => {
          const seen = new Set(cur.map(keyOf));
          return [...cur, ...filtered.filter((m) => !seen.has(keyOf(m)))];
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
    [selectedPlatforms, selectedGenres, decade, debouncedQuery],
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
      justifyContent: 'space-between' as const,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    searchBar: { paddingHorizontal: 20, paddingBottom: 8 },
    chipRow: { flexGrow: 0 },
    chipRowContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 6 },
    sectionLabel: { color: c.mut, paddingHorizontal: 20, paddingBottom: 4, paddingTop: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: c.card,
    },
    chipActive: { backgroundColor: c.accSoft },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
    // FlashList (numColumns=3) ya reparte el ancho en 3 columnas: la celda
    // ocupa SU columna entera y centra el póster. Un ancho en % aquí es % de
    // la columna, no de la pantalla (31.6% dejaba el póster desbordado a la
    // izquierda y un hueco a la derecha).
    cell: { width: '100%', alignItems: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 2 },
    caption: { fontFamily: 'Inter-SemiBold' as const, color: c.ink, fontSize: 11, width: 92, textAlign: 'center' as const },
    list: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 4 },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 24 },
    footer: { paddingVertical: 16 },
    retry: { minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
    clearBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: c.accSoft,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
    },
  }));

  const chipStyle = (active: boolean) => [styles.chip, active ? styles.chipActive : null, !active && SHADOWS.card];
  const chipText = (active: boolean) =>
    [textStyle('bodySmall', { fontSize: 12, fontFamily: 'Inter-SemiBold' }), { color: active ? colors.acc : colors.ink }];


  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={textStyle('screenTitle', { color: colors.ink })}>
          Explorar
        </Text>
        {hasActiveFilters ? (
          <Pressable
            onPress={clearAllFilters}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Limpiar filtros"
          >
            <X size={14} color={colors.acc} />
            <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), { color: colors.acc, fontSize: 12 }]}>Limpiar</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Buscador por título */}
      <View style={styles.searchBar}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar películas y series..." />
      </View>

      {/* P17: Buscador por director / actor */}
      <View style={styles.searchBar}>
        <SearchBar
          value={creditQuery}
          onChangeText={setCreditQuery}
          placeholder="Buscar por director o actor..."
        />
      </View>

      {/* Plataformas - multi-select (E2: etiqueta + padding uniforme) */}
      <Text style={styles.sectionLabel}>Plataformas</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {PLATFORMS.map((p) => (
          <Pressable
            key={p.id}
            testID={`explore-platform-${p.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedPlatforms.includes(p.id) }}
            onPress={() => togglePlatform(p.id)}
            style={chipStyle(selectedPlatforms.includes(p.id))}
          >
            <Text style={chipText(selectedPlatforms.includes(p.id))}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Géneros - multi-select */}
      <Text style={styles.sectionLabel}>Géneros</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {GENRES.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedGenres.includes(g.id) }}
            onPress={() => toggleGenre(g.id)}
            style={chipStyle(selectedGenres.includes(g.id))}
          >
            <Text style={chipText(selectedGenres.includes(g.id))}>{g.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Décadas - single-select en su propia sección */}
      <Text style={styles.sectionLabel}>Décadas</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
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
          <EmptyState icon={Film} title={hasActiveFilters ? "Sin resultados" : "Nada aquí todavía"} message={hasActiveFilters ? "Prueba a relajar los filtros activos." : "Explora el catálogo completo."} />
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
