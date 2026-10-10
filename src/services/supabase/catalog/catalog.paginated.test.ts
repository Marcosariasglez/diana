/// <reference types="jest" />
/**
 * VERTICE-PLAN-2, D2-1.5: pruebas del catálogo paginado con fixtures.
 *
 * Verifica (sin Supabase real, sin TMDB real) que:
 *  - browse pagina sin duplicar y con cursor correcto (offset/hasMore);
 *  - «disponible en mis plataformas» usa CUALQUIER modalidad (flatrate/rent/buy);
 *  - el filtro de género y de década acotan bien;
 *  - el orden (popularidad/voto/año/título) es estable;
 *  - search hace substring sobre título y original;
 *  - candidates se acota a [1, 1000] y ordena por popularidad;
 *  - el builder PostgREST genera los filtros correctos (cd., or sin paréntesis,
 *    year gte/lte, websearch_query, order multi-columna y range) — así el repo
 *    PostgREST y el mock comparten
 *    la misma semántica;
 *  - el mapper fila<->Media reconstruye fecha, géneros y plataformas.
 */
import { browseRows, candidatesRows, filterBrowse, searchRows } from './engine';
import { availablePlatforms, mediaToRow, rowToMedia } from './mapper';
import {
  buildBrowseQuery,
  buildCandidatesQuery,
  buildSearchQuery,
  platformFilter,
  toQueryStrings,
} from './query';
import { movieRows, row } from './fixtures';

describe('catálogo paginado (D2-1.5) — motor', () => {
  const rows = movieRows(30);

  it('browse pagina de 10 en 10 sin duplicar y con cursor/hasMore correctos', () => {
    const p0 = browseRows(rows, { limit: 10, cursor: 0, sort: 'popularity' });
    const p1 = browseRows(rows, { limit: 10, cursor: 10, sort: 'popularity' });
    const p2 = browseRows(rows, { limit: 10, cursor: 20, sort: 'popularity' });
    expect(p0.items).toHaveLength(10);
    expect(p1.items).toHaveLength(10);
    expect(p2.items).toHaveLength(10);
    expect(p0.hasMore).toBe(true);
    expect(p2.hasMore).toBe(false);
    expect(p0.nextCursor).toBe(10);
    expect(p2.nextCursor).toBeNull();
    const all = [...p0.items, ...p1.items, ...p2.items];
    expect(new Set(all.map((r) => r.tmdb_id)).size).toBe(30);
    // Orden por popularidad descendente (en el fixture popularity = id).
    expect(all.map((r) => r.popularity)).toEqual([...all.map((r) => r.popularity)].sort((a, b) => b - a));
  });

  it('«disponible en mis plataformas» coincide en CUALQUIER modalidad (flatrate/rent/buy)', () => {
    const netflix = browseRows(rows, { platforms: ['netflix'], sort: 'popularity' });
    for (const r of netflix.items) {
      expect(availablePlatforms(r).includes('netflix')).toBe(true);
    }
    // La fila 10: flatrate prime-video, rent max → NO está en netflix.
    const r10 = rows.find((r) => r.tmdb_id === 10)!;
    expect(r10.platforms_flatrate).toEqual(['prime-video']);
    expect(r10.platforms_rent).toEqual(['max']);
    expect(netflix.items.some((r) => r.tmdb_id === 10)).toBe(false);
    // Pero SÍ aparece en «max» (rent) y en «prime-video» (flatrate).
    expect(browseRows(rows, { platforms: ['max'], sort: 'popularity' }).items.some((r) => r.tmdb_id === 10)).toBe(true);
    expect(browseRows(rows, { platforms: ['prime-video'], sort: 'popularity' }).items.some((r) => r.tmdb_id === 10)).toBe(true);
  });

  it('el filtro de género acota a los títulos con ese id', () => {
    const romance = filterBrowse(rows, { genre: 10749 });
    expect(romance.length).toBeGreaterThan(0);
    for (const r of romance) expect(r.genre_ids).toContain(10749);
  });

  it('el filtro de década acota al rango [AAAA, AAAA+9]', () => {
    const d2000 = filterBrowse(rows, { decade: 2000 });
    expect(d2000.length).toBeGreaterThan(0);
    for (const r of d2000) {
      expect(r.year).toBeGreaterThanOrEqual(2000);
      expect(r.year).toBeLessThanOrEqual(2009);
    }
  });

  it('sort por voto y por año es estable (desempate media_type,tmdb_id)', () => {
    const byVote = browseRows(rows, { sort: 'vote', limit: 30 });
    const votes = byVote.items.map((r) => r.vote_average);
    expect(votes).toEqual([...votes].sort((a, b) => b - a));
    const byYear = browseRows(rows, { sort: 'year', limit: 30 });
    const years = byYear.items.map((r) => r.year as number);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('search hace substring sobre título y original (case-insensitive)', () => {
    const r = rows.find((x) => x.tmdb_id === 7)!;
    r.title = 'La Larga Noche';
    const hit = searchRows(rows, { query: 'noche', limit: 10 });
    expect(hit.items.some((x) => x.tmdb_id === 7)).toBe(true);
    // Y en original_title.
    r2title();
    function r2title() {
      const q = searchRows(rows, { query: `original ${7}`, limit: 10 });
      expect(q.items.some((x) => x.tmdb_id === 7)).toBe(true);
    }
  });

  it('candidates se acota a 1000 como máximo y ordena por popularidad', () => {
    const big = candidatesRows(rows, ['netflix', 'prime-video', 'filmin', 'max', 'disney-plus'], undefined, 5000);
    expect(big.length).toBeLessThanOrEqual(rows.length);
    const pops = big.map((r) => r.popularity);
    expect(pops).toEqual([...pops].sort((a, b) => b - a));
    const capped = candidatesRows(rows, [], undefined, 999999);
    expect(capped.length).toBeLessThanOrEqual(1000);
  });

  it('sortAndPage con cursor más allá del final devuelve vacío y hasMore=false', () => {
    const p = browseRows(rows, { cursor: 999, limit: 10, sort: 'popularity' });
    expect(p.items).toHaveLength(0);
    expect(p.hasMore).toBe(false);
    expect(p.nextCursor).toBeNull();
  });
});

describe('catálogo paginado (D2-1.5) — builder PostgREST', () => {
  it('buildBrowseQuery: plataformas → or con cd.{…} sobre los tres arrays (sin paréntesis)', () => {
    const q = buildBrowseQuery({ platforms: ['netflix', 'max'] });
    const orFilter = q.filters.find((f) => f.op === 'or');
    expect(orFilter).toBeDefined();
    const s = platformFilter(['netflix', 'max']);
    expect(orFilter!.val).toBe(s);
    expect(s).toContain('platforms_flatrate=cd.{netflix}');
    expect(s).toContain('platforms_rent=cd.{netflix}');
    expect(s).toContain('platforms_buy=cd.{max}');
    // supabase-js añade los paréntesis: el valor de .or() no los lleva.
    expect(s.startsWith('(')).toBe(false);
    expect(s.endsWith(')')).toBe(false);
  });

  it('buildBrowseQuery: género cd.{id}, década year gte/lte, orden y range', () => {
    const q = buildBrowseQuery({ genre: 18, decade: 2010, sort: 'vote', cursor: 40, limit: 20, type: 'movie' });
    expect(q.filters).toEqual([
      { col: 'media_type', op: 'eq', val: 'movie' },
      { col: 'genre_ids', op: 'cd', val: '{18}' },
      { col: 'year', op: 'gte', val: '2010' },
      { col: 'year', op: 'lte', val: '2019' },
    ]);
    expect(q.order).toBe('vote_average.desc,vote_count.desc,media_type.asc,tmdb_id.asc');
    expect(q.range).toEqual([40, 59]);
    // La serialización legible lo refleja (tests/log).
    expect(toQueryStrings(q)).toContain('genre_ids=cd.{18}');
    expect(toQueryStrings(q)).toContain('year=gte.2010');
    expect(toQueryStrings(q)).toContain('offset=40');
  });

  it('buildSearchQuery: FTS en español (websearch_query) con comillas escapadas', () => {
    const q = buildSearchQuery({ query: "el gato's", type: 'tv' });
    expect(q.filters).toContainEqual({ col: 'media_type', op: 'eq', val: 'tv' });
    expect(q.filters).toContainEqual({ col: 'title_tsv', op: 'websearch_query', val: "'el gato''s'" });
  });

  it('buildCandidatesQuery: solo plataformas (y tipo), sin offset, tope 1000', () => {
    const q = buildCandidatesQuery(['filmin'], 'movie', 5000);
    expect(q.filters).toEqual([{ col: 'media_type', op: 'eq', val: 'movie' }, { col: null, op: 'or', val: platformFilter(['filmin']) }]);
    expect(q.range).toEqual([0, 999]); // acotado a 1000
  });
});

describe('catálogo paginado (D2-1.5) — mapper', () => {
  it('rowToMedia (movie) reconstruye fecha a AAAA-01-01, géneros y plataformas unidas', () => {
    const m = rowToMedia(
      row({
        tmdb_id: 42,
        title: 'Casi héroe',
        original_title: 'Almost a Hero',
        year: 2015,
        genre_ids: [18, 10749],
        runtime: 120,
        platforms_flatrate: ['netflix'],
        platforms_rent: ['max'],
        platforms_buy: ['disney-plus'],
      }),
    );
    expect(m.media_type).toBe('movie');
    if (m.media_type === 'movie') {
      expect(m.title).toBe('Casi héroe');
      expect(m.release_date).toBe('2015-01-01');
      expect(m.runtime).toBe(120);
    }
    expect(m.genres.map((g) => g.id)).toEqual([18, 10749]);
    // Plataformas = unión de las tres modalidades.
    expect([...m.platforms].sort()).toEqual(['disney-plus', 'max', 'netflix']);
    // El título original pasa a alt_titles.
    expect(m.alt_titles).toEqual(['Almost a Hero']);
  });

  it('rowToMedia con year NULL reconstruye «sin fecha» (0000-01-01), NO el año actual', () => {
    // Año ausente (NULL en la base): no debe inventarse el año actual
    // (contaminaría décadas, orden por año y el filtro de import). mediaMeta
    // oculta los años <= 0.
    const m = rowToMedia(row({ tmdb_id: 77, title: 'Sin año', year: null }));
    expect(m.media_type).toBe('movie');
    if (m.media_type === 'movie') {
      expect(m.release_date).toBe('0000-01-01');
    }
    expect(m.platforms).toEqual(['netflix']);
  });

  it('rowToMedia (tv) usa name/first_air_date/seasons vacías', () => {
    const s = rowToMedia(row({ tmdb_id: 7, media_type: 'tv', title: 'Serie', year: 2020 }));
    expect(s.media_type).toBe('tv');
    if (s.media_type === 'tv') {
      expect(s.name).toBe('Serie');
      expect(s.first_air_date).toBe('2020-01-01');
      expect(s.seasons).toEqual([]);
    }
  });

  it('mediaToRow pone las plataformas en flatrate (mock) y recupera el año', () => {
    const media = rowToMedia(row({ tmdb_id: 9, title: 'Prueba', year: 1999, platforms_flatrate: ['netflix'] }));
    const back = mediaToRow(media);
    expect(back.tmdb_id).toBe(9);
    expect(back.year).toBe(1999);
    expect(back.platforms_flatrate).toEqual(['netflix']);
    expect(back.genre_ids).toEqual([18]);
  });

  it('availablePlatforms une las tres modalidades sin duplicar', () => {
    expect(
      availablePlatforms({ platforms_flatrate: ['netflix', 'max'], platforms_rent: ['max'], platforms_buy: [] }),
    ).toEqual(['netflix', 'max']);
  });
});
