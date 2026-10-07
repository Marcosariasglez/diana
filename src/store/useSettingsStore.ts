import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReducedMotionOverride = 'system' | 'on' | 'off';

interface SettingsState {
  reducedMotion: ReducedMotionOverride;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setReducedMotion: (v: ReducedMotionOverride) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      reducedMotion: 'system',
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
    }),
    {
      name: 'diana.settings.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ reducedMotion: s.reducedMotion }),
      migrate: (state) => state as SettingsState,
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
        else useSettingsStore.setState({ hasHydrated: true });
      },
    },
  ),
);