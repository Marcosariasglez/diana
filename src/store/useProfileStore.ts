import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PLATFORMS } from '@/constants/platforms';
import { deriveGenrePreferences } from '@/recommender/taste';
import type { InitialRating } from '@/types/rating';
import { useHistoryStore } from './useHistoryStore';
import { profileRepository } from '@/services';
import { reportSyncError } from '@/lib/syncError';

export type { InitialRating } from '@/types/rating';

export const DEFAULT_USER_ID = 'user-me';
export const DEFAULT_DISPLAY_NAME = 'Juan';

export interface UserProfile {
  id: string;
  displayName: string;
  initialRatings: Record<number, InitialRating>;
  /**
   * P6 (F3-1): `genre_ids` del swipe de onboarding por mediaId (vienen de
   * `initial_ratings.genre_ids`). Con ellos el gusto se calcula sin buscar el
   * titulo en ningun catalogo (taste.ts sin lookup).
   */
  initialGenres: Record<number, number[]>;
  favoriteGenres: number[];
  favoritePlatforms: string[];
}

export interface ProfileState {
  profile: UserProfile;
  hasOnboarded: boolean;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setDisplayName: (name: string) => void;
  setFavoritePlatforms: (ids: string[]) => void;
  addInitialRating: (mediaId: number, value: InitialRating, genreIds?: number[]) => void;
  completeOnboarding: () => void;
}

export const createDefaultProfile = (): UserProfile => ({
  id: DEFAULT_USER_ID,
  displayName: DEFAULT_DISPLAY_NAME,
  initialRatings: {},
  initialGenres: {},
  favoriteGenres: [],
  favoritePlatforms: [...DEFAULT_PLATFORMS],
});

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: createDefaultProfile(),
      hasOnboarded: false,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      setDisplayName: (name) => {
        set((s) => ({ profile: { ...s.profile, displayName: name } }));
        void profileRepository.saveProfile({ displayName: name }).catch(reportSyncError);
      },
      setFavoritePlatforms: (ids) => {
        set((s) => ({ profile: { ...s.profile, favoritePlatforms: [...ids] } }));
        void profileRepository.saveProfile({ favoritePlatforms: [...ids] }).catch(reportSyncError);
      },
      addInitialRating: (mediaId, value, genreIds) => {
        // P6 (F3-1): los géneros del swipe se guardan en el store: son la señal
        // con la que se calcula el gusto (ya no hay lookup del catalogo).
        set((s) => ({
          profile: {
            ...s.profile,
            initialRatings: { ...s.profile.initialRatings, [mediaId]: value },
            ...(genreIds !== undefined
              ? { initialGenres: { ...s.profile.initialGenres, [mediaId]: genreIds } }
              : {}),
          },
        }));
        void profileRepository.saveInitialRating(mediaId, value, genreIds ?? []).catch(reportSyncError);
      },
      completeOnboarding: () => {
        const { profile } = get();
        const favoriteGenres = deriveGenrePreferences(
          profile.initialRatings,
          useHistoryStore.getState().entries,
          profile.initialGenres,
        );
        set({ hasOnboarded: true, profile: { ...profile, favoriteGenres } });
        void profileRepository.saveProfile({ hasOnboarded: true, favoriteGenres }).catch(reportSyncError);
      },
    }),
    {
      name: 'diana.profile.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ profile: s.profile, hasOnboarded: s.hasOnboarded }),
      migrate: (state) => state as ProfileState,
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
        else useProfileStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** id del usuario actual (`profile.id`). */
export const useCurrentUserId = (): string => useProfileStore((s) => s.profile.id);
export const selectCurrentUserId = (s: ProfileState): string => s.profile.id;
