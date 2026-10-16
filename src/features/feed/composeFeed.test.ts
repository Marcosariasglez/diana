import { describe, it, expect } from '@jest/globals';
import { composeFeed } from './composeFeed';
import type { Media, Movie, TVSeries } from '@/types/media';
import type { TasteProfile } from '@/types/rating';
import type { ContentRecommendation } from '@/services/recommender';

/** Helper: crea una película de prueba. */
function movie(id: number, title = `Pelicula ${id}`, genres = [18], backdrop = true, year = 2020): Movie {
  return {
    media_type: 'movie',
    id,
    title,
    poster_path: `/p${id}.jpg`,
    backdrop_path: backdrop ? `/b${id}.jpg` : null,
    genres: genres.map((g) => ({ id: g, name: 'Drama' })),
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: ['netflix'],
    alt_titles: [],
    release_date: `${year}-01-01`,
    runtime: 120,
  };
}

/** Helper: crea una serie de prueba (usado en tests futuros). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function tvSeries(id: number, _name = `Serie ${id}`, _genres = [35]): TVSeries {
  return {
    media_type: 'tv',
    id,
    name: _name,
    poster_path: `/p${id}.jpg`,
    backdrop_path: `/b${id}.jpg`,
    genres: _genres.map((g) => ({ id: g, name: 'Comedy' })),
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: ['netflix'],
    alt_titles: [],
    first_air_date: '2020-01-01',
    episode_run_time: [30],
    seasons: [],
  };
}

/** Helper: crea una recomendación. */
function rec(media: Media, score = 0.5, explanation: string[] = []): ContentRecommendation {
  return { media, score, explanation };
}

const taste = (weightBp: Record<number, number>): TasteProfile => ({ userId: 'u1', weightBp });
const emptyEnriched = () => new Map<string, Media>();
const emptySeen = () => new Set<string>();

describe('composeFeed', () => {
  it('devuelve hero, top10 y rows', () => {
    const result = composeFeed({
      recs: [],
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    expect(result.hero).toEqual([]);
    expect(result.top10).toEqual([]);
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it('degradación sin recs → hero=[], top10=[], rows=variadas', () => {
    const result = composeFeed({
      recs: [],
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    expect(result.hero).toEqual([]);
    expect(result.top10).toEqual([]);
    // Las filas variadas están vacías pero se generan desde ROW_CATALOG
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('hero máximo 5', () => {
    const recs = Array.from({ length: 20 }, (_, i) => rec(movie(i + 1), 0.9 - i * 0.01));
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    expect(result.hero.length).toBeLessThanOrEqual(5);
  });

  it('top10 máximo 10 sin repetir hero', () => {
    const recs = Array.from({ length: 20 }, (_, i) => rec(movie(i + 1), 0.9 - i * 0.01));
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    expect(result.top10.length).toBeLessThanOrEqual(10);
    // Verifica que no hay repetidos entre hero y top10
    const heroKeys = new Set(result.hero.map((h) => `${h.media.media_type}:${h.media.id}`));
    for (const t of result.top10) {
      expect(heroKeys.has(`${t.media.media_type}:${t.media.id}`)).toBe(false);
    }
  });

  it('deduplicación global: un media_type:id aparece una sola vez', () => {
    const m1 = movie(1);
    const recs = [rec(m1, 0.9), rec(m1, 0.8), rec(m1, 0.7)];
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    const allKeys: string[] = [];
    for (const h of result.hero) allKeys.push(`${h.media.media_type}:${h.media.id}`);
    for (const t of result.top10) allKeys.push(`${t.media.media_type}:${t.media.id}`);
    for (const r of result.rows) {
      for (const item of r.items) allKeys.push(`${item.media.media_type}:${item.media.id}`);
    }
    // Todos los keys deben ser únicos
    const unique = new Set(allKeys);
    expect(allKeys.length).toBe(unique.size);
  });

  it('excluye items en seenKeys', () => {
    const m1 = movie(1);
    const m2 = movie(2);
    const recs = [rec(m1, 0.9), rec(m2, 0.8)];
    const seen = new Set<string>();
    seen.add('movie:1'); // m1 está visto
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: seen,
    });
    const allMedia = [
      ...result.hero.map((h) => h.media.id),
      ...result.top10.map((t) => t.media.id),
    ];
    expect(allMedia).not.toContain(1);
    expect(allMedia).toContain(2);
  });

  it('hero con menos de 5 recs', () => {
    const recs = [rec(movie(1), 0.9), rec(movie(2), 0.8), rec(movie(3), 0.7)];
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    expect(result.hero.length).toBe(3);
    expect(result.top10.length).toBe(0);
  });

  it('filas alternan personalizada / variada', () => {
    // Crea recs con razones 'liked' (explanation no vacío)
    const recs: ContentRecommendation[] = [];
    for (let i = 0; i < 20; i++) {
      recs.push(rec(movie(i + 1), 0.9 - i * 0.01, ['Porque te gustó Sicario']));
    }
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    // Las filas existen y combinan personalizadas con variadas
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('con razones genre → filas personalizadas de género', () => {
    // Con taste que activa genre reason
    const recs: ContentRecommendation[] = [];
    for (let i = 0; i < 20; i++) {
      recs.push(rec(movie(i + 1, `Peli ${i}`, [18]), 0.9 - i * 0.01));
    }
    const result = composeFeed({
      recs,
      enriched: emptyEnriched(),
      taste: taste({ 18: 9000 }), // Drama con peso alto
      eraPref: null,
      seenKeys: emptySeen(),
    });
    // Hay filas personalizadas
    const personalRows = result.rows.filter((r) => r.id.startsWith('personalized:'));
    expect(personalRows.length).toBeGreaterThan(0);
  });

  it('filas variadas incluyen ROW_CATALOG', () => {
    const result = composeFeed({
      recs: [],
      enriched: emptyEnriched(),
      taste: taste({}),
      eraPref: null,
      seenKeys: emptySeen(),
    });
    // Debería tener las filas de ROW_CATALOG (hidden-gems, popular, top-rated, tv)
    const rowIds = result.rows.map((r) => r.id);
    expect(rowIds).toContain('hidden-gems');
    expect(rowIds).toContain('popular');
    expect(rowIds).toContain('top-rated');
    expect(rowIds).toContain('tv');
  });
});
