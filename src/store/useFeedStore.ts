import { create } from 'zustand';
import type { AffinityBucket, FeedCategory, MediaWithAffinity } from '@/types/media';
import { catalogRepository } from '@/services';
import { activeRecommender, contentRecommend } from '@/services/recommender';
import { getRankingContext } from './rankingContext';
import { useProfileStore } from './useProfileStore';

/** score del RPC `recommend` ([-1,1], 0 en frío) → cubo de afinidad. */
function bucketFromScore(score: number): AffinityBucket {
  // Mismos umbrales relativos que bucketOfTenths (alto/medio/bajo) pero sobre
  // un score normalizado: >0.25 alto, >=0 medio, resto bajo.
  return score > 0.25 ? 'alto' : score >= 0 ? 'medio' : 'bajo';
}

/**
 * D2-2.6: primer página del feed con el recomendador activo. `content` →
 * RPC `recommend` (candidatos ya ordenados por afinidad, sin vistos, dentro
 * de las plataformas); si devuelve null (sin sesión, 0007 sin desplegar,
 * error) DECAE a la heurística actual. En `heuristic` (defecto) no toca el
 * servidor.
 */
async function loadFirstPageContent(
  platforms: string[],
): Promise<{ featured: MediaWithAffinity | null; categories: FeedCategory[]; hasMore: boolean } | null> {
  const recs = await contentRecommend({ platforms, limit: 60 });
  if (!recs || recs.length === 0) return null;
  const [first, ...rest] = recs;
  return {
    featured: { media: first.media, bucket: bucketFromScore(first.score) },
    categories: [
      {
        id: 'recommendations',
        title: 'Recomendaciones',
        media: rest.slice(0, 5).map((r) => ({ media: r.media, bucket: bucketFromScore(r.score) })),
        hasSeeAll: false,
      },
    ],
    hasMore: rest.length > 5,
  };
}

export type { FeedCategory, MediaWithAffinity } from '@/types/media';

export interface FeedState {
  featured: MediaWithAffinity | null;
  categories: FeedCategory[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  page: number;
  hasMore: boolean;
  loadFirstPage: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  /** Vuelve a idle; llamar al cambiar el filtro global de plataformas o el historial. */
  reset: () => void;
}

const INITIAL = {
  featured: null,
  categories: [] as FeedCategory[],
  status: 'idle' as const,
  page: 0,
  hasMore: false,
};

// Descarta respuestas de peticiones anteriores a un reset o a otra carga.
let requestId = 0;

function mergeCategories(current: FeedCategory[], incoming: FeedCategory[]): FeedCategory[] {
  const merged = current.map((c) => ({ ...c }));
  for (const cat of incoming) {
    const target = merged.find((c) => c.id === cat.id);
    if (!target) {
      merged.push(cat);
      continue;
    }
    const keys = new Set(target.media.map((m) => `${m.media.media_type}:${m.media.id}`));
    target.media = [
      ...target.media,
      ...cat.media.filter((m) => !keys.has(`${m.media.media_type}:${m.media.id}`)),
    ];
    target.hasSeeAll = cat.hasSeeAll;
  }
  return merged;
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  ...INITIAL,
  loadFirstPage: async () => {
    const id = ++requestId;
    set({ ...INITIAL, status: 'loading' });
    try {
      const platforms = useProfileStore.getState().profile.favoritePlatforms;
      const ctx = getRankingContext();
      // D2-2.6: si el recomendador es 'content' y responde, usa sus
      // candidatos (orden por afinidad real); si no (null) decae a la
      // heurística actual sin que el usuario note nada.
      let content: { featured: MediaWithAffinity | null; categories: FeedCategory[]; hasMore: boolean } | null = null;
      if (activeRecommender() === 'content') {
        content = await loadFirstPageContent(platforms);
      }
      if (id !== requestId) return;
      if (content) {
        set({
          featured: content.featured,
          categories: content.categories,
          // El RPC `recommend` aún NO tiene paginación (devuelve hasta 60
          // candidatos de una vez); `loadNextPage` llamaría al repositorio
          // heurístico y mezclaría páginas heurísticas a mitad del feed de
          // contenido. Se marca NO paginable hasta que el RPC tenga paging/
          // caché de continuación (D2-2.6).
          hasMore: false,
          page: 0,
          status: 'ready',
        });
        return;
      }
      const [featured, first] = await Promise.all([
        catalogRepository.getFeatured(platforms, ctx),
        catalogRepository.getFeedCategories(platforms, ctx, 0),
      ]);
      if (id !== requestId) return;
      set({ featured, categories: first.categories, hasMore: first.hasMore, page: 0, status: 'ready' });
    } catch {
      if (id === requestId) set({ status: 'error' });
    }
  },
  loadNextPage: async () => {
    const { status, hasMore, page } = get();
    if (status !== 'ready' || !hasMore) return;
    const id = ++requestId;
    try {
      const platforms = useProfileStore.getState().profile.favoritePlatforms;
      const next = await catalogRepository.getFeedCategories(platforms, getRankingContext(), page + 1);
      if (id !== requestId) return;
      set((s) => ({
        categories: mergeCategories(s.categories, next.categories),
        hasMore: next.hasMore,
        page: page + 1,
      }));
    } catch {
      if (id === requestId) set({ status: 'error' });
    }
  },
  reset: () => {
    requestId++;
    set({ ...INITIAL });
  },
}));
