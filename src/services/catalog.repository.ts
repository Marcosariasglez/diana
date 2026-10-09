import type { FeedCategory, Media, MediaType, MediaWithAffinity, Movie, TVSeason } from '@/types/media';
import type { Complexity, MoodFilters } from '@/types/mood';
import type { MediaKey, RankingContext } from '@/types/rating';
import { QUESTIONS_BY_COMPLEXITY } from '@/features/mood/questions';
import { CATALOG, getMedia, getTvSeason } from '@/mocks/data/catalog';
import { fakeDelay } from '@/mocks/latency';
import { bucketOfTenths } from '@/mocks/mock-ai/predict';
import {
  buildGroupDeckMedia,
  getOnboardingDeckMovies,
  pickCategoryItems,
  pickFeatured,
  pickFeedPage,
  rankMoodResults,
} from '@/mocks/mock-ai';

export interface CatalogRepository {
  /** D2-2.5: con `platforms` el mazo usa «populares en tus plataformas» (0 valoraciones). */
  getOnboardingDeck(count: number, platforms?: ReadonlyArray<string>): Promise<Movie[]>;
  getFeatured(platforms: string[], ctx: RankingContext): Promise<MediaWithAffinity | null>;
  getFeedCategories(
    platforms: string[],
    ctx: RankingContext,
    page: number,
  ): Promise<{ categories: FeedCategory[]; hasMore: boolean }>;
  getCategoryItems(
    category: 'hidden-gems' | 'recommendations',
    platforms: string[],
    ctx: RankingContext,
    page: number,
  ): Promise<{ items: MediaWithAffinity[]; hasMore: boolean }>;
  getMediaById(type: MediaType, id: number): Promise<Media | null>;
  getTvSeason(id: number, seasonNumber: number): Promise<TVSeason | null>;
  getMoodResults(
    input: { answers: Record<string, string>; complexity: Complexity; platforms: string[] },
    ctx: RankingContext,
  ): Promise<MediaWithAffinity[]>;
  getGroupDeck(input: {
    excludeKeys: ReadonlySet<MediaKey>;
    filters: MoodFilters;
    count: number;
  }): Promise<Movie[]>;
}

/** Semilla fija del orden del mazo de grupo (el contrato de getGroupDeck no lleva codigo de sala). */
export const GROUP_DECK_SEED = 'group-deck';

export const catalogRepository: CatalogRepository = {
  async getOnboardingDeck(count, platforms) {
    await fakeDelay();
    return getOnboardingDeckMovies(count, CATALOG, platforms);
  },
  async getFeatured(platforms, ctx) {
    await fakeDelay();
    return pickFeatured(platforms, ctx);
  },
  async getFeedCategories(platforms, ctx, page) {
    await fakeDelay();
    return pickFeedPage(platforms, ctx, page);
  },
  async getCategoryItems(category, platforms, ctx, page) {
    await fakeDelay();
    return pickCategoryItems(category, platforms, ctx, page);
  },
  async getMediaById(type, id) {
    await fakeDelay();
    return getMedia(type, id) ?? null;
  },
  async getTvSeason(id, seasonNumber) {
    await fakeDelay();
    return getTvSeason(id, seasonNumber) ?? null;
  },
  async getMoodResults(input, ctx) {
    await fakeDelay();
    // Solo cuentan las respuestas del banco de la complejidad elegida.
    const allowed = new Set<string>(QUESTIONS_BY_COMPLEXITY[input.complexity]);
    const answers: Record<string, string> = {};
    for (const [qid, aid] of Object.entries(input.answers)) if (allowed.has(qid)) answers[qid] = aid;
    return rankMoodResults({ answers, fallbackPlatforms: input.platforms }, ctx).map((r) => ({
      media: r.media,
      bucket: bucketOfTenths(r.tenths),
    }));
  },
  async getGroupDeck({ excludeKeys, filters, count }) {
    await fakeDelay();
    return buildGroupDeckMedia({ code: GROUP_DECK_SEED, filters, excludeKeys, count });
  },
};
