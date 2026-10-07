import type { HistoryEntry, InitialRating, MediaKey } from '@/types/rating';
import type { ImportResult } from '@/types/import';

export interface RemoteUserData {
  profile: { displayName: string; favoritePlatforms: string[]; favoriteGenres: number[]; hasOnboarded: boolean };
  initialRatings: Record<number, InitialRating>;
  initialGenres: Record<number, number[]>;
  entries: HistoryEntry[];
  watched: MediaKey[];
}

export interface ProfileRepository {
  /** null en modo mock: no hay servidor. */
  load(): Promise<RemoteUserData | null>;
  saveProfile(p: Partial<RemoteUserData['profile']>): Promise<void>;
  saveInitialRating(mediaId: number, value: InitialRating, genreIds: number[]): Promise<void>;
  saveImport(result: ImportResult, genresByKey?: Record<MediaKey, number[]>): Promise<void>;
  removeEntry(key: MediaKey): Promise<void>;
}

export const mockProfileRepository: ProfileRepository = {
  async load() { return null; },
  async saveProfile() {},
  async saveInitialRating() {},
  async saveImport() {},
  async removeEntry() {},
};
