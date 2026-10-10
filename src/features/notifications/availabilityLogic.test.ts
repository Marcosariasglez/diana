// D2-4: detección pura de «Ya está en tu plataforma».
// Reglas clave: sin base no se avisa (solo se guarda); solo cuentan las
// plataformas del usuario; se avisa de las plataformas NUEVAS; si el título
// desaparece del catálogo se actualiza la base a [] (re-avisa si vuelve).
import type { Media, Movie } from '@/types/media';
import { detectNewlyAvailable, availabilityMessage, keyOf } from './availabilityLogic';

function movie(id: number, platforms: string[]): Movie {
  return {
    id,
    media_type: 'movie',
    title: `Peli ${id}`,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: [],
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms,
    alt_titles: [],
  };
}

const OWN = ['netflix', 'prime-video'];
const resolveFor = (map: Record<number, string[]>): ((t: 'movie' | 'tv', id: number) => Media | undefined) =>
  (t, id) => (t === 'movie' && map[id] ? movie(id, map[id]) : undefined);

describe('detectNewlyAvailable (D2-4)', () => {
  it('primera vez (sin base): no avisa, pero guarda la base de todos', () => {
    const r = detectNewlyAvailable(
      [{ mediaType: 'movie', mediaId: 1 }],
      resolveFor({ 1: ['netflix', 'max'] }),
      OWN,
      {},
    );
    expect(r.news).toEqual([]);
    // Solo plataformas propias: max no cuenta.
    expect(r.nextBaseline).toEqual({ 'movie:1': ['netflix'] });
  });

  it('plataforma nueva respecto a la base: avisa solo con las nuevas', () => {
    const r = detectNewlyAvailable(
      [{ mediaType: 'movie', mediaId: 1 }],
      resolveFor({ 1: ['netflix', 'prime-video'] }),
      OWN,
      { 'movie:1': ['netflix'] },
    );
    expect(r.news).toHaveLength(1);
    expect(r.news[0].key).toBe('movie:1');
    expect(r.news[0].newPlatforms).toEqual(['prime-video']);
    expect(r.news[0].nowPlatforms).toEqual(['netflix', 'prime-video']);
    expect(r.nextBaseline).toEqual({ 'movie:1': ['netflix', 'prime-video'] });
  });

  it('sin cambios respecto a la base: no avisa', () => {
    const r = detectNewlyAvailable(
      [{ mediaType: 'movie', mediaId: 1 }],
      resolveFor({ 1: ['netflix'] }),
      OWN,
      { 'movie:1': ['netflix'] },
    );
    expect(r.news).toEqual([]);
  });

  it('plataformas ajenas al usuario nunca generan aviso', () => {
    const r = detectNewlyAvailable(
      [{ mediaType: 'movie', mediaId: 1 }],
      resolveFor({ 1: ['max', 'disney-plus'] }),
      OWN,
      { 'movie:1': [] },
    );
    expect(r.news).toEqual([]);
    expect(r.nextBaseline).toEqual({ 'movie:1': [] });
  });

  it('título fuera del catálogo: base a [] y sin aviso', () => {
    const r = detectNewlyAvailable(
      [{ mediaType: 'movie', mediaId: 99 }],
      resolveFor({}),
      OWN,
      { 'movie:99': ['netflix'] },
    );
    expect(r.news).toEqual([]);
    expect(r.nextBaseline).toEqual({ 'movie:99': [] });
  });

  it('vuelve a estar disponible: re-avisa (la base se había vaciado)', () => {
    const r = detectNewlyAvailable(
      [{ mediaType: 'movie', mediaId: 99 }],
      resolveFor({ 99: ['netflix'] }),
      OWN,
      { 'movie:99': [] },
    );
    expect(r.news).toHaveLength(1);
    expect(r.news[0].newPlatforms).toEqual(['netflix']);
  });

  it('varios títulos: solo se avisa de los que ganan plataforma', () => {
    const r = detectNewlyAvailable(
      [
        { mediaType: 'movie', mediaId: 1 },
        { mediaType: 'movie', mediaId: 2 },
      ],
      resolveFor({ 1: ['netflix'], 2: ['netflix', 'prime-video'] }),
      OWN,
      { 'movie:1': ['netflix'], 'movie:2': ['netflix'] },
    );
    expect(r.news.map((n) => n.key)).toEqual(['movie:2']);
  });
});

describe('availabilityMessage (D2-4)', () => {
  const item = {
    key: 'movie:1',
    mediaType: 'movie' as const,
    mediaId: 1,
    media: movie(1, ['netflix', 'prime-video']),
    nowPlatforms: ['netflix', 'prime-video'],
    isNews: true,
    newPlatforms: ['prime-video'],
  };

  it('una plataforma: sin «y»', () => {
    const m = availabilityMessage(item);
    expect(m.title).toBe('Ya está en tu plataforma: Peli 1');
    expect(m.body).toContain('Prime Video');
    expect(m.body).not.toContain('y Prime');
  });

  it('dos plataformas: conjunción con «y»', () => {
    const m = availabilityMessage({ ...item, newPlatforms: ['netflix', 'prime-video'] });
    expect(m.body).toBe('«Peli 1» ahora está en Netflix y Prime Video.');
  });
});

describe('keyOf (D2-4)', () => {
  it('distingue tipo e id', () => {
    expect(keyOf({ mediaType: 'movie', mediaId: 5 })).toBe('movie:5');
    expect(keyOf({ mediaType: 'tv', mediaId: 5 })).toBe('tv:5');
  });
});
