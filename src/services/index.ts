// P9 (F4-2): facade SOLO Supabase/TMDB.
// Los repositorios mock se han eliminado.
// Ya no lee BACKEND/CATALOG de env.ts (eso muere en P10).

import type { CatalogRepository, GROUP_DECK_SEED } from './catalog.types';
import { tmdbCatalogRepository } from './tmdb/catalog.repository';
import type { RatingRepository } from './rating.types';
import { supabaseRatingRepository } from './supabase/rating.repository';
import type { ProfileRepository, RemoteUserData } from './profile.types';
import { supabaseProfileRepository } from './supabase/profile.repository';
import type { RoomRepository } from './room.types';
import { supabaseRoomRepository } from './supabase/room.repository';
import type { SearchRepository } from './search.types';
import { tmdbSearchRepository } from './tmdb/search.repository';
import type { ImportRepository } from './import.types';
import { ImportError, IMPORT_ERROR_MESSAGES } from './import.types';
import { tmdbImportRepository } from './tmdb/import.repository';
import type { WatchlistRepository } from './watchlist.types';
import { supabaseWatchlistRepository } from './supabase/watchlist.repository';
import { RoomError } from './room.errors';

export const catalogRepository: CatalogRepository = tmdbCatalogRepository;
export const ratingRepository: RatingRepository = supabaseRatingRepository;
export const profileRepository: ProfileRepository = supabaseProfileRepository;
export const roomRepository: RoomRepository = supabaseRoomRepository;
export const searchRepository: SearchRepository = tmdbSearchRepository;
export const importRepository: ImportRepository = tmdbImportRepository;
export const watchlistRepository: WatchlistRepository = supabaseWatchlistRepository;

export type { CatalogRepository } from './catalog.types';
export { GROUP_DECK_SEED } from './catalog.types';
export type { ImportRepository } from './import.types';
export { ImportError, IMPORT_ERROR_MESSAGES } from './import.types';
export type { ProfileRepository, RemoteUserData } from './profile.types';
export type { RatingRepository } from './rating.types';
export type { RoomRepository } from './room.types';
export type { SearchRepository } from './search.types';
export type { WatchlistRepository } from './watchlist.types';
export { RoomError } from './room.errors';
