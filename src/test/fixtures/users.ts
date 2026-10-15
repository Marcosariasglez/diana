// P8 (F4-1): usuarios de test PROPIOS, independientes de `src/mocks/data/fakeUsers`
// (que muere en P12). Mismos ids, nombres y `initialRatings` que `FAKE_USERS`
// (los asientan seen, friends y fakeSocket); los `initialGenres` se derivan de
// `fixtureGenreIds` (mismos géneros que el catálogo mock para estos ids), así
// el perfil de gusto de cada usuario es idéntico al anterior.
import type { HistoryEntry, InitialRating, Rating } from '@/types/rating';
import { fixtureGenreIds } from './catalog';

/** Estructura compatible con `FakeUser` (sin lookup de catálogo, P6). */
export interface TestUser {
  userId: string;
  name: string;
  initial: string;
  /** mediaId de película del fixture → like | skip | unseen. */
  initialRatings: Record<number, InitialRating>;
  /** `genre_ids` de cada película valorada (del fixture). */
  initialGenres: Record<number, number[]>;
}

const BASE = [
  {
    // Drama y romance de autor.
    userId: 'user-maria',
    name: 'María',
    initial: 'M',
    initialRatings: {
      2: 'like',
      3: 'like',
      4: 'like',
      5: 'like',
      14: 'like',
      16: 'like',
      17: 'like',
      22: 'skip',
      25: 'skip',
      27: 'skip',
      31: 'unseen',
      44: 'unseen',
      36: 'unseen',
    },
  },
  {
    // Accion y ciencia ficcion.
    userId: 'user-carlos',
    name: 'Carlos',
    initial: 'C',
    initialRatings: {
      22: 'like',
      23: 'like',
      24: 'like',
      26: 'like',
      40: 'like',
      41: 'like',
      43: 'like',
      18: 'skip',
      14: 'skip',
      16: 'skip',
      31: 'unseen',
      35: 'unseen',
      33: 'unseen',
    },
  },
  {
    // Comedia y animacion.
    userId: 'user-ana',
    name: 'Ana',
    initial: 'A',
    initialRatings: {
      18: 'like',
      19: 'like',
      21: 'like',
      35: 'like',
      36: 'like',
      38: 'like',
      39: 'like',
      27: 'skip',
      29: 'skip',
      48: 'skip',
      3: 'unseen',
      40: 'unseen',
      42: 'unseen',
    },
  },
  {
    // Terror y thriller.
    userId: 'user-lucas',
    name: 'Lucas',
    initial: 'L',
    initialRatings: {
      27: 'like',
      28: 'like',
      29: 'like',
      30: 'like',
      12: 'like',
      13: 'like',
      48: 'like',
      36: 'skip',
      38: 'skip',
      14: 'skip',
      31: 'unseen',
      19: 'unseen',
      4: 'unseen',
    },
  },
  {
    // Documental y drama.
    userId: 'user-sofia',
    name: 'Sofía',
    initial: 'S',
    initialRatings: {
      31: 'like',
      32: 'like',
      33: 'like',
      34: 'like',
      1: 'like',
      4: 'like',
      9: 'like',
      23: 'skip',
      24: 'skip',
      27: 'skip',
      40: 'unseen',
      22: 'unseen',
      26: 'unseen',
    },
  },
] as const;

/** Amigos de test. No incluyen al usuario actual (user-me). */
export const TEST_USERS: ReadonlyArray<TestUser> = BASE.map((u) => ({
  ...u,
  initialGenres: Object.fromEntries(
    Object.keys(u.initialRatings).map((id) => [Number(id), fixtureGenreIds(Number(id))]),
  ),
}));

/** Usuario concreto por userId (p. ej. el «Carlos» del test S11 de vistos). */
export function testUserById(userId: string): TestUser {
  const u = TEST_USERS.find((x) => x.userId === userId);
  if (!u) throw new Error(`testUserById: no existe el usuario ${userId}`);
  return u;
}

/**
 * Entradas de ejemplo de historial con `genreIds` (lo que persiste la BD en
 * `history_entries.genre_ids`); para tests de gusto/ranking que necesitan
 * entradas además de `initialRatings`.
 */
export function testEntry(
  mediaId: number,
  userRating: Rating,
  ratedAt = '2024-01-01T00:00:00.000Z',
): Pick<HistoryEntry, 'key' | 'ref' | 'userRating' | 'genreIds' | 'ratedAt'> {
  return {
    key: `movie:${mediaId}`,
    ref: { mediaType: 'movie', mediaId },
    userRating,
    genreIds: fixtureGenreIds(mediaId),
    ratedAt,
  };
}
