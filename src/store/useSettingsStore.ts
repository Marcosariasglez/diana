import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReducedMotionOverride = 'system' | 'on' | 'off';
export type Appearance = 'light' | 'dark' | 'auto';

interface SettingsState {
  reducedMotion: ReducedMotionOverride;
  appearance: Appearance;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setReducedMotion: (v: ReducedMotionOverride) => void;
  setAppearance: (v: Appearance) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      reducedMotion: 'system',
      appearance: 'auto',
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
      setAppearance: (v) => set({ appearance: v }),
    }),
    {
      name: 'diana.settings',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) =>
        ({ reducedMotion: s.reducedMotion, appearance: s.appearance } as never),
      migrate: (state, version) => {
        if (version === 1) {
          return {
            ...(state as object),
            appearance: 'auto',
          } as never;
        }
        return state as never;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
        else useSettingsStore.setState({ hasHydrated: true });
      },
    },
  ),
);