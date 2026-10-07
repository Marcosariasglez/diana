import { createDefaultProfile, useProfileStore } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';
import { useFeedStore } from './useFeedStore';
import { useRoomStore } from './useRoomStore';
import { profileRepository } from '@/services';

/** Devuelve los stores persistentes y de sesion al estado inicial (cambio de usuario o cierre de sesion). */
export function resetLocalStores(userId?: string): void {
  useRoomStore.getState().leaveRoom();
  useFeedStore.getState().reset();
  useHistoryStore.setState({ entries: [], watched: [] });
  useProfileStore.setState({ profile: { ...createDefaultProfile(), ...(userId ? { id: userId } : {}) }, hasOnboarded: false });
}

/** Al iniciar sesion: si el usuario local no es este, se descarta lo local (B-D10). */
export async function bootstrapUserData(userId: string): Promise<void> {
  if (useProfileStore.getState().profile.id !== userId) resetLocalStores(userId);
  const remote = await profileRepository.load();
  if (!remote) return; // modo mock
  useProfileStore.setState({
    profile: {
      id: userId,
      displayName: remote.profile.displayName,
      initialRatings: remote.initialRatings,
      favoriteGenres: remote.profile.favoriteGenres,
      favoritePlatforms: remote.profile.favoritePlatforms,
    },
    hasOnboarded: remote.profile.hasOnboarded,
  });
  useHistoryStore.setState({ entries: remote.entries, watched: remote.watched });
  useFeedStore.getState().reset();
}
