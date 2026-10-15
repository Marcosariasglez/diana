import type { HistoryEntry, InitialRating, MediaKey } from '@/types/rating';
import type { ImportResult } from '@/types/import';

// P9: los tipos se exportaron a profile.types.ts; se mantiene el export aquí
// para compatibilidad (se borra este fichero en P9).
import type { ProfileRepository, RemoteUserData } from './profile.types';
export type { RemoteUserData, ProfileRepository } from './profile.types';

export const mockProfileRepository: ProfileRepository = {
  async load() { return null; },
  async saveProfile() {},
  async saveInitialRating() {},
  async saveImport() {},
  async removeEntry() {},
};
