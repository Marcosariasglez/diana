// P6: catálogo de filas variadas para el feed de Inicio.
// Definiciones puras — sin efectos, sin estado.

import type { BrowseParams } from '@/services/supabase/catalog/types';

export interface RowDefinition {
  id: string;
  title: string;
  /** Parámetros de consulta al catálogo (sin plataformas, se inyectan después). */
  params: Pick<BrowseParams, 'genre' | 'genres' | 'decade' | 'type' | 'sort'>;
  /** Si tiene id de categoría, enlaza a «Ver todo». */
  seeAll?: string;
}

/** Filas variadas del catálogo (no personalizadas). */
export const ROW_CATALOG: readonly RowDefinition[] = [
  {
    id: 'hidden-gems',
    title: 'Joyas ocultas',
    params: { sort: 'vote', type: 'movie' },
  },
  {
    id: 'popular',
    title: 'Populares en tus plataformas',
    params: { sort: 'popularity' },
    seeAll: 'popular',
  },
  {
    id: 'top-rated',
    title: 'Mejor valoradas',
    params: { sort: 'vote' },
    seeAll: 'top-rated',
  },
  {
    id: 'tv',
    title: 'Series para maratonear',
    params: { type: 'tv', sort: 'popularity' },
    seeAll: 'tv',
  },
];

/** Filas de género exploratorio: se generan dinámicamente. */
export function genreExploreRow(genreId: number, genreName: string): RowDefinition {
  return {
    id: `genre-${genreId}`,
    title: `Explora: ${genreName}`,
    params: { genre: genreId },
    seeAll: `genre-${genreId}`,
  };
}

/** Filas de década. */
export function decadeRow(decade: number, label: string): RowDefinition {
  return {
    id: `decade-${decade}`,
    title: `Cine de los ${label}`,
    params: { decade },
    seeAll: `decade-${decade}`,
  };
}

export function getRowById(id: string): RowDefinition | undefined {
  return ROW_CATALOG.find((r) => r.id === id);
}
