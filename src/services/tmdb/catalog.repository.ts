import type { Media, MediaType, Movie, TVSeason } from '@/types/media';
import type { CatalogRepository } from '../catalog.repository';
import { GROUP_DECK_SEED } from '../catalog.repository';
import { QUESTIONS_BY_COMPLEXITY } from '@/features/mood/questions';
import { bucketOfTenths } from '@/mocks/mock-ai/predict';
import { getOnboardingDeckMovies } from '@/mocks/mock-ai/onboardingDeck';
import { buildGroupDeckMedia, rankMoodResults } from '@/mocks/mock-ai/moodFilters';
import { pickCategoryItems, pickFeatured, pickFeedPage } from '@/mocks/mock-ai/hiddenGems';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { invokeTmdb } from './invoke';

/**
 * VERTICE-PLAN-2 D2-1.5: ya no hay un «pool fijo» descargado de una vez. El
 * pool es ahora un conjunto de CANDIDATOS filtrados (300–1000) consultado al
 * repositorio paginado (`catalog_titles` vía PostgREST en modo tmdb, memoria
 * en modo mock). Se filtra por las plataformas del usuario cuando se dan.
 */
const POOL_SIZE = 600;
export async function getPool(platforms?: ReadonlyArray<string>): Promise<Media[]> {
  return activeCatalogSource.candidates(platforms ? [...platforms] : [], undefined, POOL_SIZE);
}

const mediaCache = new Map<string, Media>();
const seasonCache = new Map<string, TVSeason>();

export const tmdbCatalogRepository: CatalogRepository = {
  async getOnboardingDeck(count, platforms) {
    // El pool se pide SIN filtrar por plataformas: si el proveedor filtrado
    // tiene menos de `count` títulos, el helper completa el mazo con el resto
    // del catálogo (paridad con el comportamiento documentado/probado del
    // mock: «si no hay suficientes disponibles, se completa con el resto»).
    // Filtrar aquí eliminaría TODOS los candidatos de fallback.
    const pool = await getPool();
    return getOnboardingDeckMovies(count, pool, platforms ? [...platforms] : undefined);
  },
  async getFeatured(platforms, ctx) { return pickFeatured(platforms, ctx, await getPool(platforms)); },
  async getFeedCategories(platforms, ctx, page) { return pickFeedPage(platforms, ctx, page, await getPool(platforms)); },
  async getCategoryItems(category, platforms, ctx, page) {
    return pickCategoryItems(category, platforms, ctx, page, await getPool(platforms));
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
    return rankMoodResults({ answers, fallbackPlatforms: input.platforms }, ctx, await getPool(input.platforms)).map((r) => ({
      media: r.media,
      bucket: bucketOfTenths(r.tenths),
    }));
  },
  async getGroupDeck({ excludeKeys, filters, count }) {
    const pool = await getPool(filters.fallbackPlatforms);
    return buildGroupDeckMedia({ code: GROUP_DECK_SEED, filters, excludeKeys, count, catalog: pool }) as Movie[];
  },
};
