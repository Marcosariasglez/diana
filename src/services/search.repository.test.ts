import { CATALOG } from '@/mocks/data/catalog';
import { MOCK_EPISODE_HIGHLIGHTS, searchRepository } from './search.repository';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

describe('searchRepository', () => {
  it('caso de referencia "Fall": Fall (Pelicula), Fallout (Serie), Fallout T1 · E3 (Capitulo), en ese orden', async () => {
    const { results, hasMore } = await searchRepository.search({ query: 'Fall' });
    expect(hasMore).toBe(false);
    expect(results.map((r) => [r.title, r.label, r.kind])).toEqual([
      ['Fall', 'Película', 'movie'],
      ['Fallout', 'Serie', 'tv'],
      ['Fallout T1 · E3', 'Capítulo', 'episode'],
    ]);
    const episode = results[2];
    expect(episode).toMatchObject({
      mediaId: 8,
      mediaType: 'tv',
      seriesTitle: 'Fallout',
      seasonNumber: 1,
      episodeNumber: 3,
    });
    expect(results[0]).toMatchObject({ mediaId: 7, mediaType: 'movie' });
    for (const r of results) expect(r.posterColor).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('MOCK_EPISODE_HIGHLIGHTS fija T1 · E3 para Fallout y como mucho 2 por serie', () => {
    expect(MOCK_EPISODE_HIGHLIGHTS[8]).toContainEqual([1, 3]);
    for (const list of Object.values(MOCK_EPISODE_HIGHLIGHTS)) expect(list.length).toBeLessThanOrEqual(2);
  });

  it('coincidencia sin tildes ni mayusculas', async () => {
    const { results } = await searchRepository.search({ query: 'PARASITOS' });
    expect(results.map((r) => r.title)).toContain('Parásitos');
  });

  it('consulta vacia no devuelve nada', async () => {
    expect(await searchRepository.search({ query: '   ' })).toEqual({ results: [], hasMore: false });
  });

  it('filtra por tipo', async () => {
    const movies = await searchRepository.search({ query: 'Fall', kind: 'movie' });
    expect(movies.results.map((r) => r.kind)).toEqual(['movie']);
    const tv = await searchRepository.search({ query: 'Fall', kind: 'tv' });
    expect(tv.results.map((r) => r.title)).toEqual(['Fallout']);
    const eps = await searchRepository.search({ query: 'Fall', kind: 'episode' });
    expect(eps.results.map((r) => r.title)).toEqual(['Fallout T1 · E3']);
  });

  it.each(['Fallout T1 E3', 'Fallout S1E3', 'fallout t1 · e3', 'Fallout s1 e3'])(
    'patron de capitulo en "%s"',
    async (query) => {
      const { results } = await searchRepository.search({ query });
      const eps = results.filter((r) => r.kind === 'episode');
      expect(eps.map((e) => e.title)).toEqual(['Fallout T1 · E3']);
      expect(results.some((r) => r.title === 'Fallout' && r.kind === 'tv')).toBe(true);
    },
  );

  it('un capitulo inexistente no devuelve capitulo', async () => {
    const { results } = await searchRepository.search({ query: 'Fallout S1E99' });
    expect(results.filter((r) => r.kind === 'episode')).toEqual([]);
  });

  it('prefijo o coincidencia exacta antes que el resto, luego popularidad', async () => {
    const { results } = await searchRepository.search({ query: 'a', kind: 'movie' });
    const titles = results.map((r) => r.title.toLowerCase());
    const firstNonPrefix = titles.findIndex((t) => !t.startsWith('a'));
    const lastPrefix = titles.map((t) => t.startsWith('a')).lastIndexOf(true);
    expect(lastPrefix).toBeLessThan(firstNonPrefix === -1 ? Infinity : firstNonPrefix);
  });

  it('pagina de 12 en 12 desde la pagina 0', async () => {
    const total = CATALOG.filter((m) => m.media_type === 'movie').length;
    const p0 = await searchRepository.search({ query: 'e', kind: 'movie', page: 0 });
    expect(p0.results).toHaveLength(12);
    expect(p0.hasMore).toBe(true);
    const p1 = await searchRepository.search({ query: 'e', kind: 'movie', page: 1 });
    expect(p1.results.length).toBeGreaterThan(0);
    expect(p1.results[0].mediaId).not.toBe(p0.results[0].mediaId);
    expect(p0.results.length + p1.results.length).toBeLessThanOrEqual(total);
  });
});
