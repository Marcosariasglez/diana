// Shared service mocks for test suites that need legacy mock behavior.
// These are NOT automatically loaded - each test suite imports what it needs.
import type { CatalogRepository } from '@/services/catalog.types';
import type { RatingRepository } from '@/services/rating.types';
import type { ProfileRepository } from '@/services/profile.types';
import type { RoomRepository } from '@/services/room.types';
import type { SearchRepository } from '@/services/search.types';
import type { ImportRepository } from '@/services/import.types';
import type { WatchlistRepository } from '@/services/watchlist.types';

export const mockCatalogRepository: jest.Mocked<CatalogRepository> = {
  getOnboardingDeck: jest.fn().mockResolvedValue([]),
  getFeatured: jest.fn().mockResolvedValue(null),
  getFeedCategories: jest.fn().mockResolvedValue({ categories: [], hasMore: false }),
  getCategoryItems: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
  getMediaById: jest.fn().mockResolvedValue(null),
  getTvSeason: jest.fn().mockResolvedValue(null),
  getMoodResults: jest.fn().mockResolvedValue([]),
  getGroupDeck: jest.fn().mockResolvedValue([]),
};

export const mockRatingRepository: jest.Mocked<RatingRepository> = {
  saveRating: jest.fn().mockResolvedValue(undefined),
  getRating: jest.fn().mockResolvedValue(null),
  getAllRatings: jest.fn().mockResolvedValue([]),
};

export const mockProfileRepository: jest.Mocked<ProfileRepository> = {
  load: jest.fn().mockResolvedValue(null),
  saveProfile: jest.fn().mockResolvedValue(undefined),
  saveInitialRating: jest.fn().mockResolvedValue(undefined),
  saveImport: jest.fn().mockResolvedValue(undefined),
  removeEntry: jest.fn().mockResolvedValue(undefined),
};

export const mockRoomRepository: jest.Mocked<RoomRepository> = {
  createRoom: jest.fn().mockResolvedValue(undefined),
  joinRoom: jest.fn().mockResolvedValue(undefined),
  setReady: jest.fn().mockResolvedValue(undefined),
  startMatch: jest.fn().mockResolvedValue(undefined),
  setMoodAnswer: jest.fn().mockResolvedValue(undefined),
  confirmMood: jest.fn().mockResolvedValue(undefined),
  submitDecision: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockReturnValue(() => {}),
  subscribeDecisions: jest.fn().mockReturnValue(() => {}),
  getGroupSeenKeys: jest.fn().mockResolvedValue([]),
  beginSwipe: jest.fn(),
  leaveRoom: jest.fn(),
  backToLobby: jest.fn().mockResolvedValue(undefined),
};

export const mockSearchRepository: jest.Mocked<SearchRepository> = {
  search: jest.fn().mockResolvedValue({ results: [], hasMore: false }),
};

export const mockImportRepository: jest.Mocked<ImportRepository> = {
  parseLetterboxd: jest.fn().mockResolvedValue({ entries: [], watched: [] }),
};

export const mockWatchlistRepository: jest.Mocked<WatchlistRepository> = {
  load: jest.fn().mockResolvedValue(null),
  upsert: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
};

export class ImportError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ImportError';
    this.code = code;
  }
}

export class RoomError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'RoomError';
    this.code = code;
  }
}
