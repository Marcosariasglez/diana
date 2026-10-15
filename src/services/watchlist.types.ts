// P9 (F4-2): tipos extraídos del repositorio mock watchlist.repository.ts
// antes de borrarlo.
import type { WatchlistItem } from '@/store/useWatchlistStore';

export interface WatchlistRepository {
  load(): Promise<WatchlistItem[] | null>;
  upsert(item: WatchlistItem): Promise<void>;
  remove(mediaType: WatchlistItem['mediaType'], mediaId: number): Promise<void>;
}
