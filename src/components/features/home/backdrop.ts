const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

/** URI de la imagen horizontal; sin backdrop devuelve null (el hero usa el póster). */
export function backdropUri(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_BACKDROP_BASE}${path}`;
}
