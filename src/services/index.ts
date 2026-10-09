// Unico punto de cambio mock -> Supabase (7.7). Lee EXPO_PUBLIC_BACKEND y CATALOG.
import { BACKEND, CATALOG } from '@/lib/env';
import type { CatalogRepository } from './catalog.repository';
import { mockWatchlistRepository, type WatchlistRepository } from './watchlist.repository';
import { importRepository as mockImportRepository, type ImportRepository } from './import.repository';
import { mockProfileRepository, type ProfileRepository } from './profile.repository';
import { ratingRepository as mockRatingRepository, type RatingRepository } from './rating.repository';
import { roomRepository as mockRoomRepository, type RoomRepository } from './room.repository';
import { searchRepository as mockSearchRepository, type SearchRepository } from './search.repository';
import { activeCatalogRepository } from './catalog.select';
import { supabaseProfileRepository } from './supabase/profile.repository';
import { supabaseRatingRepository } from './supabase/rating.repository';
import { supabaseRoomRepository } from './supabase/room.repository';
import { tmdbSearchRepository } from './tmdb/search.repository';
import { tmdbImportRepository } from './tmdb/import.repository';
import { supabaseWatchlistRepository } from './supabase/watchlist.repository';

const useServer = BACKEND === 'supabase';
const useTmdb = CATALOG === 'tmdb';

/**
 * Los repositorios mock y los stores se importan entre si (dependencia circular). Para que el
 * resultado no dependa del orden de carga, la eleccion mock/Supabase se resuelve en cada uso.
 */
function lazy<T extends object>(pick: () => T): T {
  return new Proxy({} as T, { get: (_t, prop) => Reflect.get(pick(), prop) });
}

export const catalogRepository = lazy<CatalogRepository>(() => activeCatalogRepository);
export const ratingRepository = lazy<RatingRepository>(() => (useServer ? supabaseRatingRepository : mockRatingRepository));
export const profileRepository = lazy<ProfileRepository>(() => (useServer ? supabaseProfileRepository : mockProfileRepository));
export const roomRepository = lazy<RoomRepository>(() => (useServer ? supabaseRoomRepository : mockRoomRepository));
export const searchRepository = lazy<SearchRepository>(() => (useTmdb ? tmdbSearchRepository : mockSearchRepository));
export const importRepository = lazy<ImportRepository>(() => (useTmdb ? tmdbImportRepository : mockImportRepository));
// D2-3: «Quiero ver» espejo en la tabla watchlist (migración 0008). Solo con
// servidor: en modo mock la persistencia local (useWatchlistStore) basta.
export const watchlistRepository = lazy<WatchlistRepository>(() => (useServer ? supabaseWatchlistRepository : mockWatchlistRepository));

export type { CatalogRepository } from './catalog.repository';
export type { ImportRepository } from './import.repository';
export { ImportError, IMPORT_ERROR_MESSAGES } from './import.repository';
export type { ProfileRepository, RemoteUserData } from './profile.repository';
export type { RatingRepository } from './rating.repository';
export type { RoomRepository } from './room.repository';
export { RoomError } from './room.repository';
export type { SearchRepository } from './search.repository';
