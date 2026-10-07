import type { InitialRating } from '@/types/rating';

export interface FakeUser {
  userId: string;
  name: string;
  initial: string;
  /** mediaId de pelicula del catalogo mock -> like | skip | unseen. */
  initialRatings: Record<number, InitialRating>;
}

/** Amigos mock. No incluyen al usuario actual (user-me). */
export const FAKE_USERS: ReadonlyArray<FakeUser> = [
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
];
