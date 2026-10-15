// P9 (F4-2): tipos extraídos del repositorio mock catalog.repository.ts
// antes de borrarlo.
import type { FeedCategory, Media, MediaType, MediaWithAffinity, Movie, TVSeason } from '@/types/media';
import type { Complexity, MoodFilters } from '@/types/mood';
import type { MediaKey, RankingContext } from '@/types/rating';

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

/** Semilla fija del orden del mazo de grupo. */
export const GROUP_DECK_SEED = 'group-deck';
