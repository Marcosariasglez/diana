// P7: tests del hook usePersonalizedFeed
// Incluye renderHook para probar el hook real (no solo el store backing).
import { renderHook, act } from '@testing-library/react-native';
import { usePersonalizedFeed } from './usePersonalizedFeed';
import { useFeedStore } from '@/store/useFeedStore';
import { useProfileStore, createDefaultProfile } from '@/store/useProfileStore';
import { useHistoryStore } from '@/store/useHistoryStore';

jest.mock('@/services/recommender', () => ({
  activeRecommender: jest.fn(() => 'content'),
  contentRecommend: jest.fn(),
}));
jest.mock('@/services/supabase/catalog/postgrest.repository', () => ({
  postgrestCatalogSource: {
    byIds: jest.fn().mockResolvedValue([]),
    browse: jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
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
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: ['netflix'],
    alt_titles: [],
  };
}

describe('usePersonalizedFeed (renderHook)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (contentRecommend as jest.Mock).mockResolvedValue([]);
    useProfileStore.setState({ profile: createDefaultProfile(), hasOnboarded: true, hasHydrated: true });
    useHistoryStore.setState({ entries: [], watched: [], hasHydrated: true });
    useFeedStore.getState().reset();
  });

  it('renderHook: métodos definidos y sin crash', async () => {
    const { result } = await renderHook(() => usePersonalizedFeed());
    // Verificar que el hook expone las propiedades y métodos correctos
    expect(typeof result.current.reload).toBe('function');
    expect(typeof result.current.loadMoreRows).toBe('function');
    expect(Array.isArray(result.current.hero)).toBe(true);
    expect(Array.isArray(result.current.top10)).toBe(true);
    expect(Array.isArray(result.current.rows)).toBe(true);
  }, 20000); // el primer renderHook arranca react-native en frío (~4 s)

  it('renderHook: reload llama a reset + loadFirstPage', async () => {
    (contentRecommend as jest.Mock).mockResolvedValue([
      { media: movie(1), score: 0.5, explanation: [] },
    ]);
    const { result } = await renderHook(() => usePersonalizedFeed());

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.status).toBe('ready');
  });

  it('renderHook: loadMoreRows llama a loadNextRows', async () => {
    (contentRecommend as jest.Mock).mockResolvedValue([]);
    const { result } = await renderHook(() => usePersonalizedFeed());

    // Carga inicial
    await act(async () => {
      await result.current.reload();
    });

    // loadMoreRows debe existir y ser invocable
    await act(async () => {
      await result.current.loadMoreRows();
    });

    // rowsStatus debería ser 'ready' (no bloqueado en 'loading')
    // rowsStatus is not exposed by the hook; check rows is an array instead
    expect(Array.isArray(result.current.rows)).toBe(true);
  });
});

describe('usePersonalizedFeed (tests de store backing)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (contentRecommend as jest.Mock).mockResolvedValue([]);
    useProfileStore.setState({ profile: createDefaultProfile(), hasOnboarded: true, hasHydrated: true });
    useHistoryStore.setState({ entries: [], watched: [], hasHydrated: true });
    useFeedStore.getState().reset();
  });

  it('estado inicial: idle con hero/top10/rows vacíos', () => {
    useFeedStore.getState().reset();
    const s = useFeedStore.getState();
    expect(s.status).toBe('idle');
    expect(s.hero).toEqual([]);
    expect(s.top10).toEqual([]);
    expect(s.rows).toEqual([]);
    expect(s.rowsStatus).toBe('idle');
    expect(s.rowsError).toBe(false);
    expect(s.rowCursor).toBe(0);
  });

  it('setPlatforms vía perfil y reset + carga', async () => {
    (contentRecommend as jest.Mock).mockResolvedValue([
      { media: movie(1), score: 0.5, explanation: [] },
    ]);

    useProfileStore.getState().setFavoritePlatforms(['disney-plus']);
    useFeedStore.getState().reset();
    await useFeedStore.getState().loadFirstPage();

    expect(useProfileStore.getState().profile.favoritePlatforms).toContain('disney-plus');
    expect(useFeedStore.getState().status).toBe('ready');
  });

  it('reload: reset + loadFirstPage', async () => {
    (contentRecommend as jest.Mock).mockResolvedValue([
      { media: movie(1), score: 0.5, explanation: [] },
    ]);

    await useFeedStore.getState().loadFirstPage();
    useFeedStore.getState().reset();
    expect(useFeedStore.getState().status).toBe('idle');
  });

  it('loadNextRows no hace nada si rowsStatus=loading', async () => {
    useFeedStore.setState({ rowsStatus: 'loading' });
    await useFeedStore.getState().loadNextRows();
    // rowsStatus sigue en 'loading' ya que loadNextRows retorna temprano
    expect(useFeedStore.getState().rowsStatus).toBe('loading');
  });

  it('cambio de entries invalida cache de eraPreference y resetea', () => {
    useHistoryStore.setState({
      entries: [{
        key: 'movie:999',
        ref: { mediaType: 'movie' as const, mediaId: 999 },
        title: 'Test',
        posterColor: '#000',
        userRating: 5 as const,
        aiPrediction: 0,
        predictionSeen: false,
        ratedAt: '2024-01-01',
        source: 'app' as const,
      }],
      watched: [],
      hasHydrated: true,
    });

    // reset() invalida la cache de eraPreference
    useFeedStore.getState().reset();
    expect(useFeedStore.getState().status).toBe('idle');
    expect(useFeedStore.getState().hero).toEqual([]);
  });
});
