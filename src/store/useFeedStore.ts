import { create } from 'zustand';
import type { FeedCategory, MediaWithAffinity } from '@/types/media';
import { catalogRepository } from '@/services';
import { getRankingContext } from './rankingContext';
import { useProfileStore } from './useProfileStore';

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
