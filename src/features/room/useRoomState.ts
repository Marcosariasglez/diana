import { useEffect, useMemo } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import type { MoodFilters } from '@/types/mood';
import { roomPathForPhase } from '@/constants/routes';
import {
  selectAllReady,
  selectFreeSlots,
  selectGroupFilters,
  selectIsHost,
  selectMoodComplete,
  useRoomStore,
} from '@/store/useRoomStore';
import { useProfileStore } from '@/store/useProfileStore';

/**
 * Estado derivado de la sala + UNICO sitio donde se navega por `phase` (6.1):
 * cuando la fase cambia, `router.replace` a la pantalla de esa fase.
 *
 * - `opts.code`: codigo de la ruta. Si no coincide con la sala activa se llama a `joinRoom` (deep link, 5.4).
 * - `opts.navigate`: false para pantallas que solo leen la sala (por ejemplo el hub Match).
 */
export function useRoomState(opts: { code?: string; navigate?: boolean } = {}) {
  const { code: routeCode, navigate = true } = opts;
  const router = useRouter();
  const pathname = usePathname();

  const code = useRoomStore((s) => s.code);
  const hostId = useRoomStore((s) => s.hostId);
  const members = useRoomStore((s) => s.members);
  const phase = useRoomStore((s) => s.phase);
  const mood = useRoomStore((s) => s.mood);
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const currentUserId = useProfileStore((s) => s.profile.id);
  const favoritePlatforms = useProfileStore((s) => s.profile.favoritePlatforms);

  // Deep link: la ruta pide una sala distinta de la activa.
  useEffect(() => {
    if (!routeCode) return;
    const wanted = routeCode.toUpperCase();
    const s = useRoomStore.getState();
    if (s.status === 'joining' || s.code === wanted) return;
    if (s.status === 'error' && s.error !== null) return;
    void s.joinRoom(wanted);
  }, [routeCode]);

  // Navegacion por fase.
  useEffect(() => {
    if (!navigate || status !== 'active' || !code) return;
    const target = roomPathForPhase(code, phase);
    if (pathname !== target) router.replace(target as Href);
  }, [navigate, status, code, phase, pathname, router]);

  const derived = useMemo(() => {
    const slice = { hostId, members, mood };
    return {
      isHost: selectIsHost(slice, currentUserId),
      allReady: selectAllReady(slice),
      freeSlots: selectFreeSlots(slice),
      moodComplete: selectMoodComplete(slice),
      groupFilters: selectGroupFilters(slice, favoritePlatforms) as MoodFilters,
    };
  }, [hostId, members, mood, currentUserId, favoritePlatforms]);

  return {
    code,
    hostId,
    members,
    phase,
    mood,
    status,
    error,
    currentUserId,
    ...derived,
    joinRoom: useRoomStore.getState().joinRoom,
    setReady: useRoomStore.getState().setReady,
    startMatch: useRoomStore.getState().startMatch,
    leaveRoom: useRoomStore.getState().leaveRoom,
    backToLobby: useRoomStore.getState().backToLobby,
  };
}
