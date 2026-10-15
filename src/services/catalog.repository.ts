import { QUESTIONS_BY_COMPLEXITY } from '@/features/mood/questions';
import { FIXTURE_CATALOG, fixtureMedia, fixtureTvSeason } from '@/test/fixtures/catalog';
import { bucketOfTenths } from '@/recommender/predict';
import {
  buildGroupDeckMedia,
  getOnboardingDeckMovies,
  pickCategoryItems,
  pickFeatured,
  pickFeedPage,
  rankMoodResults,
} from '@/recommender';

// P9: el tipo se exportó a catalog.types.ts; se mantiene el export aquí para compatibilidad
// (se borra este fichero en P9 junto con los repos mock).
import type { CatalogRepository } from './catalog.types';
import { GROUP_DECK_SEED } from './catalog.types';
export type { CatalogRepository } from './catalog.types';
export { GROUP_DECK_SEED } from './catalog.types';

const CATALOG = FIXTURE_CATALOG;

export const catalogRepository: CatalogRepository = {
  async getOnboardingDeck(count, platforms) {
    return getOnboardingDeckMovies(count, CATALOG, platforms);
  },
  async getFeatured(platforms, ctx) {
    return pickFeatured(platforms, ctx, CATALOG);
  },
  async getFeedCategories(platforms, ctx, page) {
    return pickFeedPage(platforms, ctx, page, CATALOG);
  },
  async getCategoryItems(category, platforms, ctx, page) {
    return pickCategoryItems(category, platforms, ctx, page, CATALOG);
  },
  async getMediaById(type, id) {
    return fixtureMedia(type, id) ?? null;
  },
  async getTvSeason(id, seasonNumber) {
    return fixtureTvSeason(id, seasonNumber) ?? null;
  },
  async getMoodResults(input, ctx) {
    // Solo cuentan las respuestas del banco de la complejidad elegida.
    const allowed = new Set<string>(QUESTIONS_BY_COMPLEXITY[input.complexity]);
    const answers: Record<string, string> = {};
    for (const [qid, aid] of Object.entries(input.answers)) if (allowed.has(qid)) answers[qid] = aid;
    return rankMoodResults({ answers, fallbackPlatforms: input.platforms }, ctx, CATALOG).map((r) => ({
      media: r.media,
      bucket: bucketOfTenths(r.tenths),
    }));
  },
  async getGroupDeck({ excludeKeys, filters, count }) {
    return buildGroupDeckMedia({ code: GROUP_DECK_SEED, filters, excludeKeys, count, catalog: CATALOG });
  },
};
