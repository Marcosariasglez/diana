import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PLATFORMS } from '@/constants/platforms';
import { createDefaultProfile, useProfileStore } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';
import { useFeedStore } from './useFeedStore';
import { useRoomStore } from './useRoomStore';
import { useWatchlistStore } from './useWatchlistStore';
import { useNotificationTrayStore } from './useNotificationTrayStore';
import { profileRepository, watchlistRepository } from '@/services';
import { reportSyncError } from '@/lib/syncError';
import {
  AVAILABILITY_BASELINE_KEY,
  AVAILABILITY_LAST_CHECK_KEY,
} from '@/features/notifications/availabilityKeys';

/**
 * Devuelve los stores persistentes y de sesión al estado inicial (cambio de
 * usuario o cierre de sesión). Incluye los datos POR USUARIO que viven en
 * AsyncStorage por fuera de los stores (bandeja de avisos y base del chequeo
 * de disponibilidad): si no se limpian, el próximo usuario local del
 * dispositivo vería los avisos del anterior y arrancaría con su base de
 * disponibilidad (avisos falsos o suprimidos).
 */
export function resetLocalStores(userId?: string): void {
  useRoomStore.getState().leaveRoom();
  useFeedStore.getState().reset();
  useHistoryStore.setState({ entries: [], watched: [] });
  const watchlist = useWatchlistStore.getState();
  watchlist.setItems([]);
  // La cola de mutaciones offline es del usuario anterior: sus filas del
  // servidor pertenecen a SU cuenta (y no a la del nuevo), así que se descarta.
  watchlist.clearPending();
  useNotificationTrayStore.getState().clear();
  useProfileStore.setState({ profile: { ...createDefaultProfile(), ...(userId ? { id: userId } : {}) }, hasOnboarded: false });
  // Fire-and-forget: resetLocalStores es síncrono; las claves se borran en
  // cuanto el storage responda (el siguiente bootstrap no las lee antes).
  AsyncStorage.multiRemove([AVAILABILITY_BASELINE_KEY, AVAILABILITY_LAST_CHECK_KEY]).catch(() => undefined);
}

/**
 * Reintenta en el servidor las mutaciones que quedaron pendientes offline
 * (altas cuyo upsert falló y bajas cuyo delete falló, guardadas en el store).
 * Se detiene en el primer fallo: quedan en la cola para el próximo login.
 * (B-D9: los fallos no bloquean la app.)
 */
async function pushPendingWatchlist(): Promise<void> {
  const store = useWatchlistStore.getState();
  for (const item of [...store.pendingAdds]) {
    try {
      await watchlistRepository.upsert(item);
      store.markPushed(item.mediaType, item.mediaId);
    } catch (e) {
      reportSyncError(e);
      return;
    }
  }
  for (const key of [...store.pendingRemovals]) {
    const [mediaType, mediaId] = key.split(':');
    if (!mediaType || !mediaId) continue;
    try {
      await watchlistRepository.remove(mediaType as 'movie' | 'tv', Number(mediaId));
      store.markRemoved(mediaType as 'movie' | 'tv', Number(mediaId));
    } catch (e) {
      reportSyncError(e);
      return;
    }
  }
}

/**
 * Al iniciar sesión: si el usuario local no es este, se descarta lo local
 * (B-D10). Los valores remotos se normalizan: una columna NULL o ausente
 * (p. ej. un perfil creado sin todas las columnas) NO debe dejar campos
 * undefined en el store: persist(JSON) descarta keys undefined y en el
 * siguiente arranque la app se queda en blanco (useFeedData lee
 * favoritePlatforms.length).
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
  // D2-3: «Quiero ver» — el servidor es la fuente de verdad (RLS: solo lo
  // suyo). Si la tabla 0008 no está desplegada, fallar el resto del bootstrap:
  // se degrada a la copia local.
  try {
    const watchlist = await watchlistRepository.load();
    if (watchlist !== null) {
      // Coherencia offline: NO sustituir la lista de forma ciega. Se
      // reconcilia el snapshot del servidor con las mutaciones pendientes
      // (altas que no llegaron + bajas cuyo delete falló) y se reintenta el
      // empuje de lo que todavía quede pendiente.
      const store = useWatchlistStore.getState();
      store.setItems(store.reconcileWithServer(watchlist));
      void pushPendingWatchlist();
    }
  } catch {
    // sin 0007/0008 desplegadas o sin red: se conserva la copia local
    // (y la cola pendiente, para reintentarla en el próximo login con red)
  }
  useFeedStore.getState().reset();
}
