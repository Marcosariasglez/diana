import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SHADOWS } from '@/theme/shadows';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pill } from '@/components/ui/Pill';
import {
  clearFilters,
  DECADES,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  decadeLabel,
  setDecade,
  setSort,
  setType,
  toggleGenre,
  togglePlatform,
  type ExploreFilters,
} from '@/features/explore/exploreFilters';
import { GENRES } from '@/constants/genres';
import { PLATFORMS } from '@/constants/platforms';
import type { CatalogSort } from '@/services/supabase/catalog/types';
import type { ExploreType } from '@/features/explore/exploreFilters';

export interface FilterSheetProps {
  filters: ExploreFilters;
  onChange: (filters: ExploreFilters) => void;
  onApply: () => void;
  total?: number | null;
}

/** Contenido del panel de filtros (se renderiza dentro de un BottomSheet con snapPoints [0.85]). */
export function FilterSheet({ filters, onChange, onApply, total }: FilterSheetProps) {
  const { colors } = useTheme();
  const [showAllGenres, setShowAllGenres] = useState(false);
  const genreList = showAllGenres ? GENRES : GENRES.slice(0, 6);

  const handleTypeChange = useCallback((value: string) => {
    onChange(setType(filters, value as ExploreType));
  }, [filters, onChange]);

  const handleSortChange = useCallback((value: string) => {
    onChange(setSort(filters, value as CatalogSort));
  }, [filters, onChange]);

  const handleGenreToggle = useCallback((id: number) => {
    onChange(toggleGenre(filters, id));
  }, [filters, onChange]);

  const handlePlatformToggle = useCallback((id: string) => {
    onChange(togglePlatform(filters, id));
  }, [filters, onChange]);

  const handleDecadeToggle = useCallback((decade: number) => {
    onChange(setDecade(filters, decade));
  }, [filters, onChange]);

  const handleClear = useCallback(() => {
    onChange(clearFilters(filters));
  }, [filters, onChange]);

  const genrePills = useMemo(() =>
    genreList.map((g) => (
      <Pill
        key={g.id}
        label={g.name}
        active={filters.genres.includes(g.id)}
        onPress={() => handleGenreToggle(g.id)}
      />
    )),
    [genreList, filters.genres, handleGenreToggle],
  );

  const platformPills = useMemo(() =>
    PLATFORMS.map((p) => (
      <Pill
        key={p.id}
        label={p.name}
        active={filters.platforms.includes(p.id)}
        onPress={() => handlePlatformToggle(p.id)}
      />
    )),
    [filters.platforms, handlePlatformToggle],
  );

  const ctaLabel = total !== null && total !== undefined ? `Ver ${total} títulos` : 'Ver resultados';

  return (
    <View style={styles.root}>
      {/* Cabecera */}
      <View style={styles.header}>
        <Text style={textStyle('sectionTitle', { color: colors.ink })}>Filtros</Text>
        <Button label="Restablecer" variant="destructive" onPress={handleClear} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Tipo */}
        <View style={styles.section}>
          <Text style={[textStyle('label', { color: colors.mut })]}>Tipo</Text>
          <SegmentedControl options={TYPE_OPTIONS as typeof TYPE_OPTIONS} selected={filters.type} onChange={handleTypeChange} />
        </View>

        {/* Plataformas */}
        <View style={styles.section}>
          <Text style={[textStyle('label', { color: colors.mut })]}>Plataformas</Text>
          <View style={styles.pillWrap}>{platformPills}</View>
        </View>

        {/* Género */}
        <View style={styles.section}>
          <Text style={[textStyle('label', { color: colors.mut })]}>Género</Text>
          <View style={styles.pillWrap}>{genrePills}</View>
          {GENRES.length > 6 && !showAllGenres ? (
            <Button label="Ver todos" variant="secondary" onPress={() => setShowAllGenres(true)} />
          ) : null}
        </View>

        {/* Época */}
        <View style={styles.section}>
          <Text style={[textStyle('label', { color: colors.mut })]}>Época</Text>
          <View style={styles.pillRow}>
            {DECADES.map((d) => (
              <Pill
                key={d}
                label={decadeLabel(d)}
                active={filters.decade === d}
                onPress={() => handleDecadeToggle(d)}
              />
            ))}
          </View>
        </View>

        {/* Ordenar */}
        <View style={styles.section}>
          <Text style={[textStyle('label', { color: colors.mut })]}>Ordenar</Text>
          <SegmentedControl options={SORT_OPTIONS as typeof SORT_OPTIONS} selected={filters.sort} onChange={handleSortChange} />
        </View>
      </ScrollView>

      {/* Botón CTA fijo */}
      <View style={[styles.footer, { backgroundColor: colors.card, ...SHADOWS.card }]}>
        <Button label={ctaLabel} onPress={onApply} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    gap: 8,
    paddingBottom: 16,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
});
