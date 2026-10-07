import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFeedStore } from '@/store/useFeedStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useMoodStore } from '@/store/useMoodStore';
import { createDefaultProfile, useProfileStore } from '@/store/useProfileStore';
import { useRoomStore } from '@/store/useRoomStore';
import { useSettingsStore } from '@/store/useSettingsStore';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

type Persisted = { persist: { getOptions: () => any; rehydrate: () => Promise<void> | void } };

const persistent = [
  { name: 'diana.profile.v1', store: useProfileStore, keys: ['hasOnboarded', 'profile'] },
  { name: 'diana.history.v1', store: useHistoryStore, keys: ['entries', 'watched'] },
  { name: 'diana.settings.v1', store: useSettingsStore, keys: ['reducedMotion'] },
] as const;

describe('persistencia (6.1)', () => {
  it.each(persistent)('$name: clave, version 1, migrate y partialize sin hasHydrated ni funciones', ({ name, store, keys }) => {
    const options = (store as unknown as Persisted).persist.getOptions();
    expect(options.name).toBe(name);
    expect(options.version).toBe(1);
    expect(typeof options.migrate).toBe('function');
    const partial = options.partialize(store.getState());
    expect(Object.keys(partial).sort()).toEqual([...keys].sort());
    expect(partial).not.toHaveProperty('hasHydrated');
    for (const value of Object.values(partial)) expect(typeof value).not.toBe('function');
  });

  it('Feed, Mood y Room no usan persist', () => {
    for (const store of [useFeedStore, useMoodStore, useRoomStore]) {
      expect((store as unknown as { persist?: unknown }).persist).toBeUndefined();
    }
  });

  it('hasOnboarded solo existe en el estado de Profile', () => {
    expect(useProfileStore.getState()).toHaveProperty('hasOnboarded');
    expect(useProfileStore.getState().profile).not.toHaveProperty('hasOnboarded');
    for (const store of [useHistoryStore, useSettingsStore, useFeedStore, useMoodStore, useRoomStore]) {
      expect(store.getState()).not.toHaveProperty('hasOnboarded');
    }
  });

  it('cada store persistente tiene hasHydrated y setHasHydrated', () => {
    for (const { store } of persistent) {
      const s = store.getState() as unknown as Record<string, unknown>;
      expect(typeof s.hasHydrated).toBe('boolean');
      expect(typeof s.setHasHydrated).toBe('function');
    }
  });

  it('perfil por defecto: user-me, Juan y plataformas del wireframe 1', () => {
    expect(createDefaultProfile()).toEqual({
      id: 'user-me',
      displayName: 'Juan',
      initialRatings: {},
      favoriteGenres: [],
      favoritePlatforms: ['netflix', 'prime-video', 'max'],
    });
  });

  it('escribe en AsyncStorage solo lo particionado', async () => {
    await AsyncStorage.clear();
    useProfileStore.getState().setDisplayName('Marta');
    useHistoryStore.setState({ watched: ['movie:1'] });
    await Promise.resolve();
    const profile = JSON.parse((await AsyncStorage.getItem('diana.profile.v1')) as string);
    expect(profile.version).toBe(1);
    expect(profile.state.profile.displayName).toBe('Marta');
    expect(profile.state).not.toHaveProperty('hasHydrated');
    const history = JSON.parse((await AsyncStorage.getItem('diana.history.v1')) as string);
    expect(history.state.watched).toEqual(['movie:1']);
    expect(Object.keys(history.state).sort()).toEqual(['entries', 'watched']);
  });

  it('rehidrata y marca hasHydrated', async () => {
    useProfileStore.setState({ hasHydrated: false });
    await AsyncStorage.setItem(
      'diana.profile.v1',
      JSON.stringify({
        version: 1,
        state: { hasOnboarded: true, profile: { ...createDefaultProfile(), displayName: 'Rehidratado' } },
      }),
    );
    await (useProfileStore as unknown as Persisted).persist.rehydrate();
    expect(useProfileStore.getState().hasOnboarded).toBe(true);
    expect(useProfileStore.getState().profile.displayName).toBe('Rehidratado');
    expect(useProfileStore.getState().hasHydrated).toBe(true);
  });

  it('JSON corrupto: arranca con valores por defecto y marca hasHydrated igualmente', async () => {
    useHistoryStore.setState({ hasHydrated: false, entries: [], watched: [] });
    await AsyncStorage.setItem('diana.history.v1', '{no es json');
    await (useHistoryStore as unknown as Persisted).persist.rehydrate();
    expect(useHistoryStore.getState().entries).toEqual([]);
    expect(useHistoryStore.getState().hasHydrated).toBe(true);
  });
});

describe('completeOnboarding', () => {
  it('pone hasOnboarded y recalcula favoriteGenres con las respuestas', () => {
    useProfileStore.setState({ profile: createDefaultProfile(), hasOnboarded: false });
    useHistoryStore.setState({ entries: [], watched: [] });
    const store = useProfileStore.getState();
    store.addInitialRating(1, 'like'); // Aftersun: Drama
    store.addInitialRating(2, 'like'); // Past Lives: Drama, Romance
    store.addInitialRating(7, 'skip'); // Fall: Suspense
    useProfileStore.getState().completeOnboarding();
    const s = useProfileStore.getState();
    expect(s.hasOnboarded).toBe(true);
    expect(s.profile.favoriteGenres[0]).toBe(18);
    expect(s.profile.favoriteGenres).toContain(10749);
    expect(s.profile.favoriteGenres).not.toContain(53);
  });

  it('setFavoritePlatforms y setDisplayName actualizan el perfil', () => {
    useProfileStore.getState().setFavoritePlatforms(['max']);
    useProfileStore.getState().setDisplayName('Ana');
    expect(useProfileStore.getState().profile.favoritePlatforms).toEqual(['max']);
    expect(useProfileStore.getState().profile.displayName).toBe('Ana');
  });
});
