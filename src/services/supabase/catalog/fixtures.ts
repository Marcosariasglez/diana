// Fixtures compartidas de las pruebas del catálogo paginado (D2-1.5).
// Filas de `catalog_titles` pequeñas y deterministas. Los ids de plataforma
// son los ids ESTABLES de providers.ts (netflix, prime-video, max, filmin…).
import type { CatalogRow } from './types';

export function row(over: Partial<CatalogRow> & { tmdb_id: number }): CatalogRow {
  return {
    media_type: 'movie',
    title: `Titulo ${over.tmdb_id}`,
    original_title: `Original ${over.tmdb_id}`,
    year: 2000,
    overview: 'Sinopsis',
    genre_ids: [18],
    vote_average: 7,
    vote_count: 100,
    popularity: 10,
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    original_language: 'es',
    platforms_flatrate: ['netflix'],
    platforms_rent: [],
    platforms_buy: [],
    ...over,
  };
}

/** 30 películas repartidas en plataformas/años/géneros para probar filtros. */
export function movieRows(n: number): CatalogRow[] {
  const out: CatalogRow[] = [];
  for (let i = 1; i <= n; i++) {
    const platform = i % 3 === 0 ? 'filmin' : i % 2 === 0 ? 'prime-video' : 'netflix';
    out.push(
      row({
        tmdb_id: i,
        title: `Película ${i}`,
        year: 1990 + (i % 4) * 10, // 1990, 2000, 2010, 2020
        genre_ids: [18, i % 2 === 0 ? 10749 : 35],
        popularity: i, // orden estable y conocido
        vote_average: 5 + (i % 10) / 10,
        platforms_flatrate: [platform],
        platforms_rent: i % 5 === 0 ? ['max'] : [],
        platforms_buy: i % 7 === 0 ? ['disney-plus'] : [],
      }),
    );
  }
  return out;
}
