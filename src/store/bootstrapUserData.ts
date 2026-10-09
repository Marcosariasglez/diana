import { DEFAULT_PLATFORMS } from '@/constants/platforms';
import { createDefaultProfile, useProfileStore } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';
import { useFeedStore } from './useFeedStore';
import { useRoomStore } from './useRoomStore';
import { useWatchlistStore } from './useWatchlistStore';
import { profileRepository, watchlistRepository } from '@/services';

/** Devuelve los stores persistentes y de sesion al estado inicial (cambio de usuario o cierre de sesion). */
export function resetLocalStores(userId?: string): void {
  useRoomStore.getState().leaveRoom();
  useFeedStore.getState().reset();
  useHistoryStore.setState({ entries: [], watched: [] });
  useWatchlistStore.getState().setItems([]);
  useProfileStore.setState({ profile: { ...createDefaultProfile(), ...(userId ? { id: userId } : {}) }, hasOnboarded: false });
}

/**
 * Al iniciar sesion: si el usuario local no es este, se descarta lo local (B-D10).
 * Los valores remotos se normalizan: una columna NULL o ausente (p. ej. un perfil
 * creado sin todas las columnas) NO debe dejar campos undefined en el store:
 * persist(JSON) descarta keys undefined y en el siguiente arranque la app se
 * queda en blanco (useFeedData lee favoritePlatforms.length).
 */
export async function bootstrapUserData(userId: string): Promise<void> {
  if (useProfileStore.getState().profile.id !== userId) resetLocalStores(userId);
  const remote = await profileRepository.load();
  if (!remote) return; // modo mock
  useProfileStore.setState({
    profile: {
      id: userId,
      displayName: typeof remote.profile.displayName === 'string' ? remote.profile.displayName : '',
      initialRatings: remote.initialRatings ?? {},
      favoriteGenres: Array.isArray(remote.profile.favoriteGenres) ? remote.profile.favoriteGenres : [],
      favoritePlatforms: Array.isArray(remote.profile.favoritePlatforms)
        ? remote.profile.favoritePlatforms
        : [...DEFAULT_PLATFORMS],
    },
    hasOnboarded: remote.profile.hasOnboarded === true,
  });
  useHistoryStore.setState({ entries: remote.entries ?? [], watched: remote.watched ?? [] });
  // D2-3: «Quiero ver» — el servidor es la fuente de verdad (RLS: solo lo suyo).
  // Si la tabla 0008 no está desplegada aún, fallar el resto del bootstrap:
  // se degrada a la copia local.
  try {
    const watchlist = await watchlistRepository.load();
    if (watchlist !== null) useWatchlistStore.getState().setItems(watchlist);
  } catch {
    // sin 0007/0008 desplegadas o sin red: se conserva la copia local
  }
  useFeedStore.getState().reset();
}
