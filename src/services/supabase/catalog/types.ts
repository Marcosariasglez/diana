// VERTICE-PLAN-2, D2-1.5: tipos del catálogo paginado sobre `catalog_titles`.
// La forma de fila coincide EXACTAMENTE con la migración 0006_catalogo.sql
// (las mismas columnas, mismo orden no importa: es un objeto).

import type { MediaType } from '@/types/media';

/** Una fila de `catalog_titles` (PostgREST la devuelve así). */
export interface CatalogRow {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string;
  year: number | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  runtime: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string | null;
  platforms_flatrate: string[];
  platforms_rent: string[];
  platforms_buy: string[];
  updated_at?: string;
}

export type CatalogSort = 'popularity' | 'vote' | 'year' | 'title';

/** Parámetros de `browse` (explorar, paginado). Todos opcionales salvo el cursor. */
export interface BrowseParams {
  /** «Disponible en tus plataformas»: solo títulos que lo tienen (ids de providers.ts). */
  platforms?: ReadonlyArray<string>;
  /** Un único género (id TMDB). */
  genre?: number;
  /** Década: 2000 → [2000, 2009], 1990 → [1990, 1999], … */
  decade?: number;
  /** Tipo de medio. */
  type?: MediaType;
  sort?: CatalogSort;
  /** Cursor = offset (filas omitidas). 0/ausente = inicio. */
  cursor?: number;
  /** Tamaño de página (por defecto 20, tope 100). */
  limit?: number;
}

/** Parámetros de `search` (FTS + trigram, aproximado por substring en mock). */
export interface SearchParams {
  query: string;
  type?: MediaType;
  /** «Disponible en tus plataformas». */
  platforms?: ReadonlyArray<string>;
  cursor?: number;
  limit?: number;
}

export interface PageResult<T> {
  items: T[];
  /** Offset para la siguiente página (o null si no hay más). */
  nextCursor: number | null;
  hasMore: boolean;
}

/** Cuántos candidatos, como máximo, pasa el motor de mood/feed/grupo (300–1000). */
export const CANDIDATE_LIMIT_MIN = 300;
export const CANDIDATE_LIMIT_MAX = 1000;
export const DEFAULT_CANDIDATE_LIMIT = 600;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
