import { useHistoryStore } from './useHistoryStore';
import { useProfileStore } from './useProfileStore';
import { useSettingsStore } from './useSettingsStore';

/** true cuando los tres stores persistentes han terminado de hidratar (6.1). */
export function useStoresHydrated(): boolean {
  const profile = useProfileStore((s) => s.hasHydrated);
  const history = useHistoryStore((s) => s.hasHydrated);
  const settings = useSettingsStore((s) => s.hasHydrated);
  return profile && history && settings;
}
