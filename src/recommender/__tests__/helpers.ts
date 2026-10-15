import type { Movie } from '@/types/media';
import type { HistoryEntry, Rating } from '@/types/rating';
import { genresFromIds } from '@/constants/genres';

export const DRAMA = 18;
export const ROMANCE = 10749;
export const COMEDIA = 35;
export const ACCION = 28;
export const SCIFI = 878;

export function synthMovie(id: number, genreIds: number[], extra: Partial<Movie> = {}): Movie {
  return {
    id,
    media_type: 'movie',
    title: `Sintetica ${id}`,
    release_date: '2010-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: genresFromIds(genreIds),
    overview: '',
    vote_average: 7,
    vote_count: 1000,
    popularity: 10,
    platforms: ['netflix'],
    alt_titles: [],
    ...extra,
  };
}

/** P6 (F3-1): entrada con los `genre_ids` que la BD persiste (sin lookup). */
export function synthEntry(
  mediaId: number,
  userRating: Rating,
  genreIds: number[] = [],
): Pick<HistoryEntry, 'ref' | 'userRating' | 'genreIds'> {
  return { ref: { mediaType: 'movie', mediaId }, userRating, genreIds };
}

export const zeroNoise = () => 0;
