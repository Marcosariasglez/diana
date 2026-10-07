import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AddEntryInput, HistoryEntry, MediaKey } from '@/types/rating';
import type { ImportResult } from '@/types/import';
import { profileRepository, ratingRepository } from '@/services';
import { reportSyncError } from '@/lib/syncError';

export interface HistoryState {
  entries: HistoryEntry[];
  watched: MediaKey[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  /** Upsert por key (reglas 1-8 de 6.1). La nueva o actualizada queda la primera. */
  addEntry: (input: AddEntryInput) => Promise<HistoryEntry>;
  importResult: (r: ImportResult) => void;
  removeEntry: (key: MediaKey) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      watched: [],
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      addEntry: async (input) => {
        const entry = await ratingRepository.saveRating(input);
        set((s) => ({ entries: [entry, ...s.entries.filter((e) => e.key !== entry.key)] }));
        return entry;
      },
      importResult: (r) => {
        set((s) => {
          const present = new Set(s.entries.map((e) => e.key));
          const fresh = r.entries.filter((e, i) => {
            if (present.has(e.key)) return false;
            present.add(e.key);
            return r.entries.findIndex((x) => x.key === e.key) === i;
          });
          return {
            entries: [...fresh, ...s.entries],
            watched: Array.from(new Set([...s.watched, ...r.watched])),
          };
        });
        void profileRepository.saveImport(r).catch(reportSyncError);
      },
      removeEntry: (key) => {
        set((s) => ({ entries: s.entries.filter((e) => e.key !== key) }));
        void profileRepository.removeEntry(key).catch(reportSyncError);
      },
    }),
    {
      name: 'diana.history.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ entries: s.entries, watched: s.watched }),
      migrate: (state) => state as HistoryState,
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
        else useHistoryStore.setState({ hasHydrated: true });
      },
    },
  ),
);

export const selectEntryByKey =
  (key: MediaKey) =>
  (s: Pick<HistoryState, 'entries'>): HistoryEntry | undefined =>
    s.entries.find((e) => e.key === key);

/** Media de userRating; null si no hay entradas. */
export const selectAverageRating = (s: Pick<HistoryState, 'entries'>): number | null => {
  if (s.entries.length === 0) return null;
  let sumHalf = 0;
  for (const e of s.entries) sumHalf += Math.round(e.userRating * 2);
  return sumHalf / 2 / s.entries.length;
};

/** Claves unicas de entries y watched (no incluye initialRatings). */
export const selectSeenCount = (s: Pick<HistoryState, 'entries' | 'watched'>): number =>
  new Set<MediaKey>([...s.entries.map((e) => e.key), ...s.watched]).size;
