/**
 * VERTICE-PLAN-2, D2-3: espejo de «Quiero ver» en la tabla `watchlist`
 * (migración 0008, RLS «solo lo tuyo»).
 */
// P9: el tipo se exportó a watchlist.types.ts; se mantiene el export aquí para compatibilidad
// (se borra este fichero en P9).
import type { WatchlistRepository } from './watchlist.types';
export type { WatchlistRepository } from './watchlist.types';

export const mockWatchlistRepository: WatchlistRepository = {
  async load() {
    return null;
  },
  async upsert() {},
  async remove() {},
};
