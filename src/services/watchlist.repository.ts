import type { WatchlistItem } from '@/store/useWatchlistStore';

/**
 * VERTICE-PLAN-2, D2-3: espejo de «Quiero ver» en la tabla `watchlist`
 * (migración 0008, RLS «solo lo tuyo»).
 */
export interface WatchlistRepository {
  /** null en modo mock: no hay servidor. */
  load(): Promise<WatchlistItem[] | null>;
  upsert(item: WatchlistItem): Promise<void>;
  remove(mediaType: WatchlistItem['mediaType'], mediaId: number): Promise<void>;
}

export const mockWatchlistRepository: WatchlistRepository = {
  async load() {
    return null;
  },
  async upsert() {},
  async remove() {},
};
