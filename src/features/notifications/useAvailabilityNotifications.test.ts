// D2-4: hook de detección. Con CATALOG=tmdb compara la watchlist con el
// catálogo y la base guardada; avisa de plataformas nuevas, respeta el
// cooldown, no avisa en la primera pasada (solo fija base) y limpia avisos
// de títulos fuera de la watchlist.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/lib/env', () => ({ BACKEND: 'supabase', CATALOG: 'tmdb' }));
jest.mock('@/services/supabase/catalog/select', () => ({
  activeCatalogSource: { byIds: jest.fn() },
}));
jest.mock('@/lib/syncError', () => ({ reportSyncError: jest.fn() }));

import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { useProfileStore } from '@/store/useProfileStore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useNotificationTrayStore } from '@/store/useNotificationTrayStore';
import { useAvailabilityNotifications } from './useAvailabilityNotifications';

const mockByIds = activeCatalogSource.byIds as jest.Mock;

function media(id: number, platforms: string[]) {
  return {
    id,
    media_type: 'movie',
    title: `Peli ${id}`,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: [],
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms,
    alt_titles: [],
  };
}

const OWN = ['netflix', 'prime-video'];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockByIds.mockImplementation(async (_t: string, ids: number[]) =>
    ids.map((id) => media(id, ['netflix', 'prime-video'])),
  );
  useWatchlistStore.getState().setItems([]);
  useNotificationTrayStore.getState().clear();
  useProfileStore.setState({
    profile: { ...useProfileStore.getState().profile, favoritePlatforms: OWN },
    hasHydrated: true,
  });
});

describe('useAvailabilityNotifications (D2-4)', () => {
  it('plataforma nueva respecto a la base: añade aviso a la bandeja y actualiza la base', async () => {
    await AsyncStorage.setItem(
      'diana.availability.baseline.v1',
      JSON.stringify({ 'movie:1': ['netflix'] }),
    );
    useWatchlistStore.getState().setItems([{ mediaType: 'movie', mediaId: 1, addedAt: 'x' }]);
    await renderHook(() => useAvailabilityNotifications());
    await waitFor(() => expect(useNotificationTrayStore.getState().notices).toHaveLength(1));
    expect(useNotificationTrayStore.getState().notices[0].newPlatforms).toEqual(['prime-video']);
    expect(mockByIds).toHaveBeenCalledWith('movie', [1]);
    const base = JSON.parse((await AsyncStorage.getItem('diana.availability.baseline.v1')) as string);
    expect(base['movie:1']).toEqual(['netflix', 'prime-video']);
  });

  it('primera vez (sin base): no avisa pero fija la base', async () => {
    useWatchlistStore.getState().setItems([{ mediaType: 'movie', mediaId: 1, addedAt: 'x' }]);
    await renderHook(() => useAvailabilityNotifications());
    await waitFor(() =>
      expect(AsyncStorage.getItem('diana.availability.baseline.v1')).resolves.not.toBeNull(),
    );
    expect(useNotificationTrayStore.getState().notices).toEqual([]);
  });

  it('cooldown: si se comprobó hace poco, no toca el catálogo', async () => {
    await AsyncStorage.setItem('diana.availability.lastcheck.v1', String(Date.now()));
    useWatchlistStore.getState().setItems([{ mediaType: 'movie', mediaId: 1, addedAt: 'x' }]);
    await renderHook(() => useAvailabilityNotifications());
    await new Promise((r) => setTimeout(r, 50));
    expect(mockByIds).not.toHaveBeenCalled();
  });

  it('watchlist vacía: no comprueba', async () => {
    await renderHook(() => useAvailabilityNotifications());
    await new Promise((r) => setTimeout(r, 50));
    expect(mockByIds).not.toHaveBeenCalled();
  });

  it('watchlist vacía con avisos en la bandeja: limpia TODA la bandeja', async () => {
    // Aislamiento: al vaciar la lista (misma cuenta, sin cambiar de usuario),
    // los avisos de títulos que ya no están en la watchlist no pueden quedar
    // visibles. Antes el efecto de limpieza saltaba con items.length === 0.
    useNotificationTrayStore.getState().add({
      id: 'movie:9',
      mediaType: 'movie',
      mediaId: 9,
      newPlatforms: ['netflix'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    useWatchlistStore.getState().setItems([]);
    await renderHook(() => useAvailabilityNotifications());
    await waitFor(() => expect(useNotificationTrayStore.getState().notices).toHaveLength(0));
  });

  it('limpia de la bandeja los avisos de títulos fuera de la watchlist', async () => {
    useNotificationTrayStore.getState().add({
      id: 'movie:9',
      mediaType: 'movie',
      mediaId: 9,
      newPlatforms: ['netflix'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    useWatchlistStore.getState().setItems([{ mediaType: 'movie', mediaId: 1, addedAt: 'x' }]);
    await renderHook(() => useAvailabilityNotifications());
    await waitFor(() => expect(useNotificationTrayStore.getState().notices).toHaveLength(0));
  });
});
