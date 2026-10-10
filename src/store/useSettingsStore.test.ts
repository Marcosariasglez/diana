// D2-5 (calidad): store de ajustes. Persistencia estable (diana.settings,
// version 2) con migración v1→v2 (añade appearance) y partialize sin
// hasHydrated.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from './useSettingsStore';

type Persisted = {
  persist: {
    getOptions: () => {
      name: string;
      version: number;
      partialize: (s: unknown) => Record<string, unknown>;
      migrate: (state: Record<string, unknown>, version: number) => Record<string, unknown>;
    };
  };
};

describe('useSettingsStore (D2-5)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.setState({ reducedMotion: 'system', appearance: 'auto', hasHydrated: true });
  });

  it('setReducedMotion y setAppearance actualizan el estado', () => {
    useSettingsStore.getState().setReducedMotion('on');
    useSettingsStore.getState().setAppearance('dark');
    const s = useSettingsStore.getState();
    expect(s.reducedMotion).toBe('on');
    expect(s.appearance).toBe('dark');
  });

  it('setHasHydrated controla la bandera (no persistida)', () => {
    useSettingsStore.getState().setHasHydrated(false);
    expect(useSettingsStore.getState().hasHydrated).toBe(false);
    useSettingsStore.getState().setHasHydrated(true);
    expect(useSettingsStore.getState().hasHydrated).toBe(true);
  });

  it('persistencia: clave/version estables y partialize solo valores (sin hasHydrated)', () => {
    const options = (useSettingsStore as unknown as Persisted).persist.getOptions();
    expect(options.name).toBe('diana.settings');
    expect(options.version).toBe(2);
    const partial = options.partialize(useSettingsStore.getState());
    expect(Object.keys(partial).sort()).toEqual(['appearance', 'reducedMotion']);
    expect(partial).not.toHaveProperty('hasHydrated');
  });

  it('migración v1→v2 añade appearance=auto conservando reducedMotion', () => {
    const options = (useSettingsStore as unknown as Persisted).persist.getOptions();
    const migrated = options.migrate({ reducedMotion: 'on' }, 1);
    expect(migrated).toEqual({ reducedMotion: 'on', appearance: 'auto' });
  });

  it('migración de versión actual no altera el estado', () => {
    const options = (useSettingsStore as unknown as Persisted).persist.getOptions();
    const same = options.migrate({ reducedMotion: 'off', appearance: 'light' }, 2);
    expect(same).toEqual({ reducedMotion: 'off', appearance: 'light' });
  });

  it('escribe en AsyncStorage solo lo particionado', async () => {
    useSettingsStore.getState().setAppearance('dark');
    await Promise.resolve();
    const raw = (await AsyncStorage.getItem('diana.settings')) as string;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.state).toEqual({ reducedMotion: 'system', appearance: 'dark' });
    expect(parsed.state).not.toHaveProperty('hasHydrated');
  });
});
