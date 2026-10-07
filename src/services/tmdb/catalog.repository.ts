import type { Media, MediaType, Movie, TVSeason } from '@/types/media';
import type { CatalogRepository } from '../catalog.repository';
import { GROUP_DECK_SEED } from '../catalog.repository';
import { QUESTIONS_BY_COMPLEXITY } from '@/features/mood/questions';
import { bucketOfTenths } from '@/mocks/mock-ai/predict';
import { getOnboardingDeckMovies } from '@/mocks/mock-ai/onboardingDeck';
import { buildGroupDeckMedia, rankMoodResults } from '@/mocks/mock-ai/moodFilters';
import { pickCategoryItems, pickFeatured, pickFeedPage } from '@/mocks/mock-ai/hiddenGems';
import { invokeTmdb } from './invoke';

let poolPromise: Promise<Media[]> | null = null;
/** Pool de candidatos (unos 150 titulos de las 4 plataformas en ES), una sola carga por sesion. */
export function getPool(): Promise<Media[]> {
  if (!poolPromise) {
    poolPromise = invokeTmdb<Media[]>({ action: 'pool' }).catch((e) => {
      poolPromise = null; // permite reintentar
      throw e;
    });
  }
  return poolPromise;
}

const mediaCache = new Map<string, Media>();
const seasonCache = new Map<string, TVSeason>();

export const tmdbCatalogRepository: CatalogRepository = {
  async getOnboardingDeck(count) { return getOnboardingDeckMovies(count, await getPool()); },
  async getFeatured(platforms, ctx) { return pickFeatured(platforms, ctx, await getPool()); },
  async getFeedCategories(platforms, ctx, page) { return pickFeedPage(platforms, ctx, page, await getPool()); },
  async getCategoryItems(category, platforms, ctx, page) {
    return pickCategoryItems(category, platforms, ctx, page, await getPool());
  },
  async getMediaById(type: MediaType, id: number) {
    const k = `${type}:${id}`;
    const hit = mediaCache.get(k);
    if (hit) return hit;
    try {
      const m = await invokeTmdb<Media>({ action: 'media', type, id });
      mediaCache.set(k, m);
      return m;
    } catch {
      return null;
    }
  },
  async getTvSeason(id, seasonNumber) {
    const k = `${id}:${seasonNumber}`;
    const hit = seasonCache.get(k);
    if (hit) return hit;
    try {
      const s = await invokeTmdb<TVSeason>({ action: 'season', id, season: seasonNumber });
      seasonCache.set(k, s);
      return s;
    } catch {
      return null;
    }
  },
  async getMoodResults(input, ctx) {
    const allowed = new Set<string>(QUESTIONS_BY_COMPLEXITY[input.complexity]);
    const answers: Record<string, string> = {};
    for (const [qid, aid] of Object.entries(input.answers)) if (allowed.has(qid)) answers[qid] = aid;
    return rankMoodResults({ answers, fallbackPlatforms: input.platforms }, ctx, await getPool()).map((r) => ({
      media: r.media,
      bucket: bucketOfTenths(r.tenths),
    }));
  },
  async getGroupDeck({ excludeKeys, filters, count }) {
    const pool = await getPool();
    return buildGroupDeckMedia({ code: GROUP_DECK_SEED, filters, excludeKeys, count, catalog: pool }) as Movie[];
  },
};
