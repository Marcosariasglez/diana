// Regresión de loadNextRows: concurrencia, alcance de todas las filas y filas vacías.
import { useFeedStore } from './useFeedStore';
import { useProfileStore, createDefaultProfile } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';

jest.mock('@/services/recommender', () => ({
  activeRecommender: jest.fn(() => 'content'),
  contentRecommend: jest.fn(),
}));
jest.mock('@/services/supabase/catalog/postgrest.repository', () => ({
  postgrestCatalogSource: {
    byIds: jest.fn().mockResolvedValue([]),
    browse: jest.fn(),
  },
}));
jest.mock('@/store/rankingContext', () => ({
  getRankingContext: () => ({
    userId: 'test',
    taste: { userId: 'test', weightBp: {} },
    seenKeys: new Set<string>(),
  }),
}));

const { contentRecommend } = require('@/services/recommender');
const { postgrestCatalogSource } = require('@/services/supabase/catalog/postgrest.repository');

function movie(id: number) {
  return {
    id,
    media_type: 'movie' as const,
    title: `Pelicula ${id}`,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: [],
    overview: '',
    vote_average: 7,
    vote_count: 100,
    popularity: 10,
    platforms: ['netflix'],
    alt_titles: [],
  };
}

/** Cada llamada a browse devuelve títulos nuevos (ids únicos), así no hay dedup. */
let nextId = 1000;
function browseWithItems() {
  postgrestCatalogSource.browse.mockImplementation(async () => ({
    items: Array.from({ length: 5 }, () => movie(nextId++)),
    nextCursor: null,
    hasMore: false,
  }));
}

describe('loadNextRows — regresión', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nextId = 1000;
    (contentRecommend as jest.Mock).mockResolvedValue([]);
    useProfileStore.setState({ profile: createDefaultProfile(), hasOnboarded: true, hasHydrated: true });
    useHistoryStore.setState({ entries: [], watched: [], hasHydrated: true });
    useFeedStore.getState().reset();
  });

  it('dos loadNextRows concurrentes no dejan el estado en loading', async () => {
    browseWithItems();
    await useFeedStore.getState().loadFirstPage();
    await Promise.all([useFeedStore.getState().loadNextRows(), useFeedStore.getState().loadNextRows()]);
    expect(useFeedStore.getState().rowsStatus).toBe('ready');
    // Y se puede seguir pidiendo filas.
    await useFeedStore.getState().loadNextRows();
    expect(useFeedStore.getState().rowsStatus).toBe('ready');
  });

  it('recorrer el feed entero muestra todas las filas, sin repetir', async () => {
    browseWithItems();
    await useFeedStore.getState().loadFirstPage();
    for (let i = 0; i < 10; i++) await useFeedStore.getState().loadNextRows();
    const ids = useFeedStore.getState().rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    // «Joyas ocultas» solo sale con títulos de afinidad alta: con gusto vacío no hay.
    for (const id of ['popular', 'top-rated', 'tv']) {
      expect(ids).toContain(id);
    }
    const s = useFeedStore.getState();
    expect(s.rowCursor).toBe(s.rowTotal);
  });

  it('no muestra filas sin títulos (primera carga ni cargas siguientes)', async () => {
    postgrestCatalogSource.browse.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    await useFeedStore.getState().loadFirstPage();
    expect(useFeedStore.getState().rows.every((r) => r.items.length > 0)).toBe(true);
    for (let i = 0; i < 10; i++) await useFeedStore.getState().loadNextRows();
    const s = useFeedStore.getState();
    expect(s.rows).toEqual([]);
    expect(s.rowsStatus).toBe('ready');
    expect(s.rowCursor).toBe(s.rowTotal);
  });
});
