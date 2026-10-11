// VERTICE-PLAN-2 (fase A, A.2): nombres EN de los géneros TMDB para el texto de
// embedding (gte-small solo entiende inglés). PURO DATOS (sin imports de RN ni
// alias): lo comparten la Edge Function catalog-features (import relativo, como
// hace catalog-sync con providers.ts) y los tests. Los ids son los canónicos de
// TMDB (película y serie). Fuente: /genre/movie/list y /genre/tv/list.
export const GENRES_EN: Readonly<Record<number, string>> = {
  // Películas
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  9648: 'Mystery',
  10749: 'Music',
  10752: 'Romance',
  878: 'Science Fiction',
  10753: 'War',
  53: 'Western',
  // Series (TV)
  10759: 'Action & Adventure',
  10764: 'Children',
  10765: 'News',
  10766: 'Reality',
  10767: 'Talk',
  10762: 'Romance',
  10763: 'Sci-Fi & Fantasy',
  10768: 'Sports',
  60: 'Movies',
  10799: 'Soap',
};

/** Nombres EN de una lista de ids TMDB (los desconocidos se omiten). */
export function genresEnOf(ids: ReadonlyArray<number>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const n = GENRES_EN[id];
    if (n) out.push(n);
  }
  return out;
}
