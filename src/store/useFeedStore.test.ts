// D2-2.6: el feed usa el recomendador activo. 'content' → RPC recommend
// (si devuelve candidatos, se pintan); si devuelve null (RPC sin desplegar,
// sin sesión…) DECAE a la heurística actual sin que el usuario lo note.
// 'heuristic' (defecto) no toca el servidor.
//
// Las factories de jest.mock crean sus propios jest.fn() (referencias
// out-of-scope en el momento de la carga del store darían TDZ); las
// referencias se toman con require después de importar el módulo.
import type { Movie } from '@/types/media';

jest.mock('@/services', () => ({
  catalogRepository: { getFeatured: jest.fn(), getFeedCategories: jest.fn() },
}));
jest.mock('@/services/recommender', () => ({
  activeRecommender: jest.fn(),
  contentRecommend: jest.fn(),
}));
jest.mock('./rankingContext', () => ({ getRankingContext: () => ({}) }));
jest.mock('./useProfileStore', () => ({
  useProfileStore: { getState: () => ({ profile: { favoritePlatforms: ['netflix'] } }) },
}));

import { useFeedStore } from './useFeedStore';

const { catalogRepository } = require('@/services');
const { activeRecommender, contentRecommend } = require('@/services/recommender');
const mockGetFeatured = catalogRepository.getFeatured;
const mockGetFeedCategories = catalogRepository.getFeedCategories;

function movie(id: number, title: string): Movie {
  return {
    id,
    media_type: 'movie',
    title,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: [],
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: [],
    alt_titles: [],
  };
}

const HEURISTIC_FEED = {
  categories: [
    {
      id: 'hidden-gems' as const,
      title: 'Hidden',
      media: [{ media: movie(11, 'H1'), bucket: 'alto' as const }],
      hasSeeAll: false,
    },
  ],
  hasMore: false,
};

describe('useFeedStore con recomendador (D2-2.6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFeatured.mockResolvedValue({ media: movie(1, 'F1'), bucket: 'alto' });
    mockGetFeedCategories.mockResolvedValue(HEURISTIC_FEED);
    useFeedStore.getState().reset();
  });

  it('en heuristic (defecto) usa el catálogo de la heurística y no llama al RPC', async () => {
    activeRecommender.mockReturnValue('heuristic');
    await useFeedStore.getState().loadFirstPage();
    expect(useFeedStore.getState().status).toBe('ready');
    expect(useFeedStore.getState().featured?.media.id).toBe(1);
    expect(mockGetFeatured).toHaveBeenCalled();
    expect(contentRecommend).not.toHaveBeenCalled();
  });

  it('en content con candidatos del RPC los pinta (Recomendaciones) sin tocar la heurística', async () => {
    activeRecommender.mockReturnValue('content');
    const recs = [
      { media: movie(21, 'C1'), score: 0.6, explanation: ['Porque te gustó X'] },
      { media: movie(22, 'C2'), score: 0.1, explanation: [] },
    ];
    contentRecommend.mockResolvedValue(recs);
    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();
    expect(s.status).toBe('ready');
    expect(s.featured?.media.id).toBe(21);
    expect(s.featured?.bucket).toBe('alto'); // score > 0.25
    expect(s.categories).toHaveLength(1);
    expect(s.categories[0].id).toBe('recommendations');
    expect(s.categories[0].media.map((m) => m.media.id)).toEqual([22]);
    expect(mockGetFeatured).not.toHaveBeenCalled();
    expect(contentRecommend).toHaveBeenCalledWith({ platforms: ['netflix'], limit: 60 });
  });

  it('en content con null (RPC sin desplegar) decae a la heurística', async () => {
    activeRecommender.mockReturnValue('content');
    contentRecommend.mockResolvedValue(null);
    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();
    expect(s.status).toBe('ready');
    expect(s.featured?.media.id).toBe(1);
    expect(s.categories[0].id).toBe('hidden-gems');
    expect(mockGetFeatured).toHaveBeenCalled();
  });

  it('en content con RPC vacío decae también a la heurística', async () => {
    activeRecommender.mockReturnValue('content');
    contentRecommend.mockResolvedValue([]);
    await useFeedStore.getState().loadFirstPage();
    expect(useFeedStore.getState().featured?.media.id).toBe(1);
    expect(mockGetFeatured).toHaveBeenCalled();
  });

  it('si la heurística falla el estado queda en error', async () => {
    activeRecommender.mockReturnValue('heuristic');
    mockGetFeatured.mockRejectedValue(new Error('boom'));
    await useFeedStore.getState().loadFirstPage();
    expect(useFeedStore.getState().status).toBe('error');
  });
});
