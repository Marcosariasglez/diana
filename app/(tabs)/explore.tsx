import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui';
import { SearchBar } from '@/components/ui/SearchBar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { FilterButton } from '@/components/features/explore/FilterButton';
import { ActiveFilterChips } from '@/components/features/explore/ActiveFilterChips';
import { QueryHints } from '@/components/features/explore/QueryHints';
import { FilterSheet } from '@/components/features/explore/FilterSheet';
import { ExploreGrid } from '@/components/features/explore/ExploreGrid';
import {
  activeCount,
  clearFilters,
  INITIAL_FILTERS,
  removeChip,
  setQuery,
  type ExploreFilters,
} from '@/features/explore/exploreFilters';
import { applyHint, pendingHints } from '@/features/explore/parseQueryHints';
import { useUnifiedSearch } from '@/features/explore/useUnifiedSearch';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';

/** Padding inferior para no chocar con la bottom navigation. */
const BOTTOM_PADDING = 80;

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // ── Estado local ──────────────────────────────────────────────
  const [filters, setFilters] = useState<ExploreFilters>(INITIAL_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Datos ─────────────────────────────────────────────────────
  const { items, status, hasMore, loadMore, total, reload, loadingMore, pageError } = useUnifiedSearch(filters, { countTotal: true });

  // ── SearchBar: filters.query es la única fuente de verdad ──────
  const handleSearchChange = useCallback((text: string) => {
    setFilters((f) => setQuery(f, text));
  }, []);

  // ── QueryHints: aplicar hint → filtro activo, aplicar y quitar palabra del query ──
  const handleApplyHint = useCallback((hintLabel: string) => {
    setFilters((f) => {
      const hints = pendingHints(f);
      const hint = hints.find((h) => h.label === hintLabel);
      if (!hint) return f;
      return applyHint(f, hint);
    });
  }, []);

  // ── ActiveFilterChips: quitar chip individual ─────────────────
  const handleRemoveChip = useCallback((kind: string, value: string | number) => {
    setFilters((f) => removeChip(f, { kind: kind as Parameters<typeof removeChip>[1]['kind'], value }));
  }, []);

  // ── ActiveFilterChips: limpiar todo (conserva filters.query) ──
  const handleClearAll = useCallback(() => {
    setFilters((f) => clearFilters(f));
  }, []);

  // ── FilterSheet ───────────────────────────────────────────────
  const handleFilterChange = useCallback((newFilters: ExploreFilters) => {
    setFilters(newFilters);
  }, []);

  const openFilterSheet = useCallback(() => setSheetOpen(true), []);
  const closeFilterSheet = useCallback(() => setSheetOpen(false), []);

  // ── Navegación ────────────────────────────────────────────────
  const handlePressItem = useCallback(
    (item: Media) => {
      router.push({
        pathname: '/(tabs)/detail/[id]',
        params: { id: String(item.id), type: item.media_type },
      });
    },
    [router],
  );

  // ── Contador de resultados ────────────────────────────────────
  // Distinguir entre "cargando" (status=loading), "falló" (status=error con null) y "listo" (total definido).
  const resultsLabel =
    status === 'loading' && total === null
      ? 'Cargando…'
      : status === 'error' && total === null
        ? null
        : total !== null
          ? `${total} títulos`
          : null;

  return (
    <Screen>
      {/* Título — Fix 1: textStyle('screenTitle') + color del tema */}
      <Text style={[styles.title, textStyle('screenTitle'), { color: colors.ink }]}>Explorar</Text>

      {/* SearchBar + FilterButton */}
      <View style={styles.searchBar}>
        <SearchBar
          value={filters.query}
          onChangeText={handleSearchChange}
          placeholder="Película, director, actor, género…"
          accessory={<FilterButton count={activeCount(filters)} onPress={openFilterSheet} />}
        />
      </View>

      {/* QueryHints — solo cuando hay texto y hints pendientes */}
      <QueryHints query={filters.query} filters={filters} onApply={handleApplyHint} />

      {/* ActiveFilterChips — solo con filtros activos */}
      <ActiveFilterChips filters={filters} onRemove={handleRemoveChip} onClear={handleClearAll} />

      {/* Línea de resultados */}
      <View style={styles.resultsLine}>
        {resultsLabel !== null && (
          <Text style={[textStyle('bodySmall'), { color: colors.mut }]}>{resultsLabel}</Text>
        )}
        <Pressable onPress={openFilterSheet} accessibilityRole="button" accessibilityLabel="Ordenar">
          <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), { color: colors.acc }]}>
            Ordenar ▾
          </Text>
        </Pressable>
      </View>

      {/* ExploreGrid */}
      <ExploreGrid
        items={items}
        status={status}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onPressItem={handlePressItem}
        onRetry={reload}
        loadingMore={loadingMore}
        pageError={pageError}
        onPageRetry={loadMore}
      />

      {/* Espacio inferior para bottom nav */}
      <View style={{ height: BOTTOM_PADDING }} />

      {/* BottomSheet de filtros */}
      <BottomSheet visible={sheetOpen} onClose={closeFilterSheet} snapPoints={[0.85]}>
        <FilterSheet
          filters={filters}
          onChange={handleFilterChange}
          onApply={closeFilterSheet}
          total={total}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchBar: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  resultsLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
