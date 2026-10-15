// Rediseño Explorar (plan P1): estado de filtros del buscador unificado.
// Todo PURO: sin React ni red. El hook (`useUnifiedSearch`) y la UI lo consumen.
import { GENRES } from '@/constants/genres';
import { platformName } from '@/constants/platforms';
import type { CatalogSort } from '@/services/supabase/catalog/types';

export type ExploreType = 'all' | 'movie' | 'tv';

export interface ExploreFilters {
  query: string;
  type: ExploreType;
  platforms: string[];
  genres: number[];
  /** 1990 → [1990, 1999]. null = todas. */
  decade: number | null;
  sort: CatalogSort;
}

export const INITIAL_FILTERS: ExploreFilters = {
  query: '',
  type: 'all',
  platforms: [],
  genres: [],
  decade: null,
  sort: 'popularity',
};

export const DECADES: ReadonlyArray<number> = [2020, 2010, 2000, 1990, 1980, 1970];

export const SORT_OPTIONS: ReadonlyArray<{ value: CatalogSort; label: string }> = [
  { value: 'popularity', label: 'Popularidad' },
  { value: 'vote', label: 'Mejor valoradas' },
  { value: 'year', label: 'Más recientes' },
  { value: 'title', label: 'A–Z' },
];

export const TYPE_OPTIONS: ReadonlyArray<{ value: ExploreType; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'movie', label: 'Películas' },
  { value: 'tv', label: 'Series' },
];

const toggle = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export const setQuery = (f: ExploreFilters, query: string): ExploreFilters => ({ ...f, query });
export const setType = (f: ExploreFilters, type: ExploreType): ExploreFilters => ({ ...f, type });
export const setSort = (f: ExploreFilters, sort: CatalogSort): ExploreFilters => ({ ...f, sort });
export const toggleGenre = (f: ExploreFilters, id: number): ExploreFilters => ({ ...f, genres: toggle(f.genres, id) });
export const togglePlatform = (f: ExploreFilters, id: string): ExploreFilters => ({
  ...f,
  platforms: toggle(f.platforms, id),
});
/** Pulsar la década ya activa la desactiva (single-select). */
export const setDecade = (f: ExploreFilters, decade: number | null): ExploreFilters => ({
  ...f,
  decade: f.decade === decade ? null : decade,
});

/** «Limpiar»: quita los filtros pero conserva lo que el usuario ha escrito. */
export const clearFilters = (f: ExploreFilters): ExploreFilters => ({ ...INITIAL_FILTERS, query: f.query });

/** Nº de filtros activos (lo que cuenta el badge). El texto y el orden no cuentan. */
export function activeCount(f: ExploreFilters): number {
  return (f.type !== 'all' ? 1 : 0) + f.platforms.length + f.genres.length + (f.decade !== null ? 1 : 0);
}

export const hasActiveFilters = (f: ExploreFilters): boolean => activeCount(f) > 0;

export type FilterChipKind = 'type' | 'platform' | 'genre' | 'decade';

export interface FilterChip {
  /** Clave estable para listas. */
  key: string;
  kind: FilterChipKind;
  value: string | number;
  label: string;
}

const genreLabel = (id: number): string => GENRES.find((g) => g.id === id)?.name ?? String(id);

export const decadeLabel = (decade: number): string => `${decade}–${decade + 9}`;

/** Chips visibles bajo el buscador, en orden fijo: tipo, plataformas, géneros, década. */
export function toChips(f: ExploreFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.type !== 'all') {
    chips.push({ key: `type:${f.type}`, kind: 'type', value: f.type, label: f.type === 'movie' ? 'Películas' : 'Series' });
  }
  for (const p of f.platforms) chips.push({ key: `platform:${p}`, kind: 'platform', value: p, label: platformName(p) });
  for (const g of f.genres) chips.push({ key: `genre:${g}`, kind: 'genre', value: g, label: genreLabel(g) });
  if (f.decade !== null) chips.push({ key: `decade:${f.decade}`, kind: 'decade', value: f.decade, label: decadeLabel(f.decade) });
  return chips;
}

export function removeChip(f: ExploreFilters, chip: Pick<FilterChip, 'kind' | 'value'>): ExploreFilters {
  switch (chip.kind) {
    case 'type':
      return { ...f, type: 'all' };
    case 'platform':
      return { ...f, platforms: f.platforms.filter((p) => p !== chip.value) };
    case 'genre':
      return { ...f, genres: f.genres.filter((g) => g !== chip.value) };
    case 'decade':
      return { ...f, decade: null };
  }
}
