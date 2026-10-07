import type { Media, MediaType } from '@/types/media';
import type { HistoryEntry, InitialRating, MediaKey, TasteProfile } from '@/types/rating';
import { hash32 } from '@/utils/hash';
import { clamp, roundDiv } from '@/utils/intMath';
import { getMedia } from '@/mocks/data/catalog';

/** Funcion de ruido inyectable: devuelve un entero en bp. */
export type NoiseFn = (userId: string, key: MediaKey) => number;

/** Resuelve un titulo del catalogo; inyectable para tests con catalogos sinteticos. */
export type MediaLookup = (type: MediaType, id: number) => Media | undefined;

/** Ruido determinista por usuario y clave: entero en [-1500, 1500] bp. */
export function noiseBp(userId: string, key: MediaKey): number {
  return (hash32(userId + '|' + key) % 3001) - 1500;
}

const INITIAL_DELTA_HALF: Record<InitialRating, number> = { like: 2, skip: -1, unseen: 0 };

function rawHalfByGenre(
  initialRatings: Record<number, InitialRating>,
  entries: ReadonlyArray<Pick<HistoryEntry, 'ref' | 'userRating'>>,
  lookup: MediaLookup,
): Map<number, number> {
  const raw = new Map<number, number>();
  const add = (genreId: number, delta: number) => raw.set(genreId, (raw.get(genreId) ?? 0) + delta);

  for (const idText of Object.keys(initialRatings)) {
    const id = Number(idText);
    const media = lookup('movie', id);
    if (!media) continue;
    const delta = INITIAL_DELTA_HALF[initialRatings[id]] ?? 0;
    for (const g of media.genres) add(g.id, delta);
  }
  for (const entry of entries) {
    const media = lookup(entry.ref.mediaType, entry.ref.mediaId);
    if (!media) continue;
    const delta = Math.round(entry.userRating * 2) - 6;
    for (const g of media.genres) add(g.id, delta);
  }
  return raw;
}

/** Paso 1 (7.3): pesos por genero en bp, normalizados al maximo absoluto. */
export function buildTasteProfile(
  userId: string,
  initialRatings: Record<number, InitialRating>,
  entries: ReadonlyArray<Pick<HistoryEntry, 'ref' | 'userRating'>>,
  lookup: MediaLookup = getMedia,
): TasteProfile {
  const raw = rawHalfByGenre(initialRatings, entries, lookup);
  let m = 0;
  for (const v of raw.values()) m = Math.max(m, Math.abs(v));
  const weightBp: Record<number, number> = {};
  for (const [g, v] of raw) {
    weightBp[g] = m === 0 ? 0 : roundDiv(v * 10000, m);
  }
  return { userId, weightBp };
}

/** Paso 2 (7.3): score de gusto en bp [-10000, 10000]. */
export function tasteScoreBp(
  profile: TasteProfile,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
): number {
  const n = media.genres.length;
  let sum = 0;
  for (const g of media.genres) sum += profile.weightBp[g.id] ?? 0;
  const meanBp = n === 0 ? 0 : roundDiv(sum, n);
  return clamp(meanBp + noise(profile.userId, key), -10000, 10000);
}

/** Cantidad de generos favoritos que devuelve deriveGenrePreferences. */
export const FAVORITE_GENRES_COUNT = 5;

/**
 * Ids de genero con peso positivo, de mayor a menor (desempate por id ascendente).
 * Se usa en completeOnboarding para rellenar profile.favoriteGenres.
 */
export function deriveGenrePreferences(
  initialRatings: Record<number, InitialRating>,
  entries: ReadonlyArray<Pick<HistoryEntry, 'ref' | 'userRating'>>,
  lookup: MediaLookup = getMedia,
): number[] {
  const profile = buildTasteProfile('', initialRatings, entries, lookup);
  return Object.keys(profile.weightBp)
    .map(Number)
    .filter((g) => profile.weightBp[g] > 0)
    .sort((a, b) => profile.weightBp[b] - profile.weightBp[a] || a - b)
    .slice(0, FAVORITE_GENRES_COUNT);
}
