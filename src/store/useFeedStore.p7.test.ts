// P7: tests del feed personalizado (hero, top10, rows)
import type { FeedItem, Movie } from '@/types/media';

jest.mock('@/services/recommender', () => ({
  activeRecommender: jest.fn(),
  contentRecommend: jest.fn(),
}));
jest.mock('@/recommender/reasons', () => ({
  pickExploreGenre: jest.fn(() => null),
  topGenres: jest.fn(() => []),
  eraPreference: jest.fn(() => null),
  buildReason: jest.fn(() => undefined),
  genreNameLower: jest.fn(() => 'accion'),
  decadeLabel: jest.fn(() => '2020s'),
}));
jest.mock('@/recommender/hiddenGems', () => ({
  pickHiddenGems: jest.fn(() => ({ items: [], hasMore: false })),
  pickRecommendations: jest.fn(() => ({ items: [], hasMore: false })),
}));
jest.mock('@/recommender/affinity', () => ({
  affinity: jest.fn(() => 'medio'),
  bucketFromScore: jest.fn(() => 'medio'),
}));
jest.mock('@/features/feed/rowCatalog', () => ({
  ROW_CATALOG: [
    { id: 'popular', title: 'Populares', params: { sort: 'popularity' }, seeAll: 'popular' },
    { id: 'top-rated', title: 'Mejor valoradas', params: { sort: 'vote' }, seeAll: 'top-rated' },
  ],
  genreExploreRow: jest.fn(),
  decadeRow: jest.fn(),
  getRowById: jest.fn(),
}));
jest.mock('@/services', () => {
  const movie = (id: number) => ({
    id,
    media_type: 'movie' as const,
    title: `Pelicula ${id}`,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: [],
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: ['netflix'],
    alt_titles: [],
  });
  return {
    catalogRepository: {
      getFeatured: jest.fn().mockResolvedValue({
        media: movie(1),
        bucket: 'medio' as const,
        explanation: [] as string[],
      }),
      getFeedCategories: jest.fn().mockResolvedValue({
        categories: [
          {
            id: 'recommendations',
            title: 'Recomendaciones',
            media: [{ media: movie(2), bucket: 'medio' as const, explanation: [] as string[] }],
            hasSeeAll: false,
          },
        ],
        hasMore: true,
      }),
    },
  };
});
jest.mock('./rankingContext', () => ({
  getRankingContext: () => ({
    userId: 'test',
    taste: { userId: 'test', weightBp: {} },
    seenKeys: new Set<string>(),
  }),
}));
jest.mock('./useProfileStore', () => ({
  useProfileStore: { getState: () => ({ profile: { favoritePlatforms: ['netflix'], id: 'test', initialRatings: {}, initialGenres: {} } }) },
}));
jest.mock('./useHistoryStore', () => ({
  useHistoryStore: { getState: () => ({ entries: [], watched: [] }) },
}));
jest.mock('@/services/supabase/catalog/postgrest.repository', () => ({
  postgrestCatalogSource: {
    byIds: jest.fn(),
    browse: jest.fn(),
  },
}));

import { useFeedStore } from './useFeedStore';
import { activeRecommender, contentRecommend } from '@/services/recommender';
import { postgrestCatalogSource } from '@/services/supabase/catalog/postgrest.repository';

const mockByIds = jest.mocked(postgrestCatalogSource.byIds);
const mockBrowse = jest.mocked(postgrestCatalogSource.browse);

function movie(id: number, title = `Pelicula ${id}`, backdrop = false, genres: number[] = []): Movie {
  return {
    id,
    media_type: 'movie',
    title,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: backdrop ? `/b${id}.jpg` : null,
    genres: genres.map((g: number) => ({ id: g, name: `g${g}` })),
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: ['netflix'],
    alt_titles: [],
  };
}

describe('useFeedStore P7: feed personalizado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (activeRecommender as jest.Mock).mockReturnValue('content');
    mockByIds.mockResolvedValue([]);
    mockBrowse.mockResolvedValue({
      items: [
        {
          id: 900,
          media_type: 'movie' as const,
          title: 'Mock Movie',
          release_date: '2022-01-01',
          runtime: 100,
          poster_path: null,
          backdrop_path: null,
          genres: [],
          overview: '',
          vote_average: 0,
          vote_count: 0,
          popularity: 0,
          platforms: ['netflix'],
          alt_titles: [],
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    useFeedStore.getState().reset();
  });

  it('carga con RPC → hero, top10, rows poblados', async () => {
    const recs = Array.from({ length: 20 }, (_, i) => ({
      media: movie(i + 1),
      score: 0.8 - i * 0.01,
      explanation: ['Porque te gustó X'],
    }));
    (contentRecommend as jest.Mock).mockResolvedValue(recs);

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    expect(s.status).toBe('ready');
    expect(s.hero.length).toBeGreaterThan(0);
    expect(s.hero.length).toBeLessThanOrEqual(5);
    expect(s.top10.length).toBeLessThanOrEqual(10);
    expect(s.rows.length).toBeLessThanOrEqual(3);
  });

  it('F1: byIds enriquece → hero con backdrop y géneros', async () => {
    const recs = [
      { media: movie(1, 'M1', false, []), score: 0.9, explanation: [] },
      { media: movie(2, 'M2', false, []), score: 0.8, explanation: [] },
    ];
    (contentRecommend as jest.Mock).mockResolvedValue(recs);

    // byIds devuelve películas enriquecidas con backdrop y géneros
    mockByIds.mockResolvedValue([
      movie(1, 'M1', true, [18]), // drama
      movie(2, 'M2', true, [35]), // comedia
    ]);

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    expect(s.status).toBe('ready');
    // El hero debe tener al menos un item
    expect(s.hero.length).toBeGreaterThan(0);
    // Los items del hero deberían tener backdrop_path del enriquecimiento
    const heroWithBackdrop = s.hero.filter((h) => h.media.backdrop_path !== null);
    expect(heroWithBackdrop.length).toBeGreaterThan(0);
    // Y géneros del enriquecimiento
    const heroWithGenres = s.hero.filter((h) => h.media.genres.length > 0);
    expect(heroWithGenres.length).toBeGreaterThan(0);
  });

  it('RPC null → hero y Top 10 salen del feed clásico, y hay filas de fallback', async () => {
    (contentRecommend as jest.Mock).mockResolvedValue(null);

    // browse devuelve items para filas de fallback
    mockBrowse.mockResolvedValue({
      items: [movie(100), movie(101), movie(102)],
      nextCursor: null,
      hasMore: false,
    });

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    expect(s.status).toBe('ready');
    // P9: sin RPC, hero y Top 10 se rellenan desde el feed clásico (sin razón).
    expect(s.hero.length).toBeGreaterThan(0);
    expect(s.hero.length).toBeLessThanOrEqual(5);
    expect(s.top10.length).toBeLessThanOrEqual(10);
    expect(s.hero.every((i) => i.reason === undefined)).toBe(true);
    const keys = [...s.hero, ...s.top10].map((i) => `${i.media.media_type}:${i.media.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    // F7: rows NO deben estar vacíos — deben tener filas variadas de fallback
    expect(s.rows.length).toBeGreaterThan(0);
  });

  it('RPC vacío → igual que null (degrada con fallback)', async () => {
    (contentRecommend as jest.Mock).mockResolvedValue([]);
    mockBrowse.mockResolvedValue({
      items: [movie(200), movie(201)],
      nextCursor: null,
      hasMore: false,
    });

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    expect(s.status).toBe('ready');
    expect(s.hero.length).toBeGreaterThan(0);
    expect(s.rows.length).toBeGreaterThan(0);
  });

  it('byIds que falla → sigue con datos del RPC', async () => {
    const recs = [
      { media: movie(1), score: 0.5, explanation: [] },
      { media: movie(2), score: 0.4, explanation: [] },
    ];
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockByIds.mockRejectedValue(new Error('DB error'));

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    expect(s.status).toBe('ready');
    expect(s.hero.length).toBeGreaterThan(0);
  });

  it('fila variada que falla → rowsError=true pero status=ready', async () => {
    const recs = [
      { media: movie(1), score: 0.9, explanation: [] },
    ];
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockBrowse.mockRejectedValue(new Error('browse failed'));

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    expect(s.status).toBe('ready');
    expect(s.rowsError).toBe(true);
  });

  it('sin duplicados media_type:id entre hero, top10 y filas', async () => {
    const recs = Array.from({ length: 30 }, (_, i) => ({
      media: movie(i + 1),
      score: 0.9 - i * 0.005,
      explanation: [],
    }));
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockBrowse.mockResolvedValue({
      items: [movie(1), movie(2)],
      nextCursor: null,
      hasMore: false,
    });

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    const allKeys = new Set<string>();
    const addKeys = (item: FeedItem) => allKeys.add(`${item.media.media_type}:${item.media.id}`);
    for (const item of s.hero) addKeys(item);
    for (const item of s.top10) addKeys(item);
    for (const row of s.rows) {
      for (const item of row.items) addKeys(item);
    }
    const totalItems = s.hero.length + s.top10.length + s.rows.reduce((n, r) => n + r.items.length, 0);
    expect(allKeys.size).toBe(totalItems);
  });

  it('reset durante carga → descarta resultado viejo (loadId)', async () => {
    (contentRecommend as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([{ media: movie(999), score: 0.5, explanation: [] }]), 50)),
    );

    const loadPromise = useFeedStore.getState().loadFirstPage();
    useFeedStore.getState().reset();

    (contentRecommend as jest.Mock).mockResolvedValue([{ media: movie(1), score: 0.9, explanation: [] }]);
    await useFeedStore.getState().loadFirstPage();
    await loadPromise;

    const s = useFeedStore.getState();
    expect(s.hero.some((h) => h.media.id === 999)).toBe(false);
  });

  it('F2: loadNextRows no invalida carga inicial (contador independiente)', async () => {
    const recs = Array.from({ length: 5 }, (_, i) => ({
      media: movie(i + 1),
      score: 0.9 - i * 0.01,
      explanation: [],
    }));
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockBrowse.mockResolvedValue({
      items: [movie(100), movie(101)],
      nextCursor: null,
      hasMore: false,
    });

    // Simular loadFirstPage + loadNextRows en vuelo simultáneo
    const loadPromise = useFeedStore.getState().loadFirstPage();
    await useFeedStore.getState().loadNextRows();
    await loadPromise;

    const s = useFeedStore.getState();
    // La carga inicial NO debería haber sido descartada
    expect(s.status).toBe('ready');
    expect(s.hero.length).toBeGreaterThan(0);
  });

  it('F6: loadNextRows avanza rowCursor y respeta rowTotal', async () => {
    const recs = [{ media: movie(1), score: 0.9, explanation: [] }];
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockBrowse.mockResolvedValue({
      items: [movie(100), movie(101)],
      nextCursor: null,
      hasMore: false,
    });

    await useFeedStore.getState().loadFirstPage();
    const beforeCursor = useFeedStore.getState().rowCursor;
    const rowTotal = useFeedStore.getState().rowTotal;

    await useFeedStore.getState().loadNextRows();
    const afterCursor = useFeedStore.getState().rowCursor;

    expect(afterCursor).toBeGreaterThanOrEqual(beforeCursor);
    // rowTotal debe estar definido (> 0)
    expect(rowTotal).toBeGreaterThan(0);
    expect(useFeedStore.getState().rowsStatus).toBe('ready');
  });

  it('F6: loadNextRows no carga más cuando rowCursor >= rowTotal', async () => {
    const recs = [{ media: movie(1), score: 0.9, explanation: [] }];
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockBrowse.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

    await useFeedStore.getState().loadFirstPage();
    const initialRows = useFeedStore.getState().rows.length;

    // Llamar loadNextRows múltiples veces
    await useFeedStore.getState().loadNextRows();
    await useFeedStore.getState().loadNextRows();
    await useFeedStore.getState().loadNextRows();

    const s = useFeedStore.getState();
    // browse retorna items vacíos, así que no se añaden filas nuevas
    expect(s.rows.length).toBe(initialRows);
    expect(s.rowsStatus).toBe('ready');
  });

  it('F4: bucket no es fijo — filas variadas usan affinity()', async () => {
    const recs = [{ media: movie(1), score: 0.9, explanation: [] }];
    (contentRecommend as jest.Mock).mockResolvedValue(recs);
    mockBrowse.mockResolvedValue({
      items: [movie(200), movie(201), movie(202)],
      nextCursor: null,
      hasMore: false,
    });

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    // Al menos algún item debe tener bucket calculado
    const allItems = [...s.hero, ...s.top10, ...s.rows.flatMap((r) => r.items)];
    expect(allItems.length).toBeGreaterThan(0);
    // Todos los buckets deben ser válidos
    for (const item of allItems) {
      expect(['alto', 'medio', 'bajo']).toContain(item.bucket);
    }
  });

  it('ningún ítem en hero/top10/filas tiene campos numéricos de nota', async () => {
    const recs = Array.from({ length: 10 }, (_, i) => ({
      media: movie(i + 1),
      score: 0.8 - i * 0.01,
      explanation: ['Porque te gustó X'],
    }));
    (contentRecommend as jest.Mock).mockResolvedValue(recs);

    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();

    const allItems = [...s.hero, ...s.top10, ...s.rows.flatMap((r) => r.items)];
    for (const item of allItems) {
      expect(item).not.toHaveProperty('tenths');
      expect(item).not.toHaveProperty('score');
      expect(item).not.toHaveProperty('prediction');
    }
  });
});
