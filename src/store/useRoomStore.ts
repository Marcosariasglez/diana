import { create } from 'zustand';
import type { GroupDecision, GroupMoodState, RoomMember, RoomPhase, RoomSnapshot } from '@/types/room';
import type { MoodFilters } from '@/types/mood';
import type { MediaKey, MediaRef } from '@/types/rating';
import { GROUP_DECK_COUNT, MAX_ROOM_MEMBERS } from '@/constants/room';
import { QUESTIONS_BY_COMPLEXITY } from '@/features/mood/questions';
import { catalogRepository, roomRepository } from '@/services';
import { useProfileStore } from './useProfileStore';

export type RoomStoreErrorCode = 'not-found' | 'full';

export interface RoomState {
  code: string | null;
  hostId: string | null;
  members: RoomMember[];
  phase: RoomPhase;
  mood: GroupMoodState;
  deck: MediaRef[];
  decisions: GroupDecision[];
  status: 'idle' | 'joining' | 'active' | 'error';
  error: RoomStoreErrorCode | null;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<boolean>;
  setReady: (ready: boolean) => void;
  leaveRoom: () => void;
  startMatch: () => Promise<void>;
  setMoodAnswer: (questionId: string, answerId: string) => Promise<void>;
  confirmMood: () => Promise<void>;
  submitDecision: (key: MediaKey, decision: 'like' | 'skip') => Promise<void>;
  /** Anadido: "Volver a la sala" (fase lobby, sin respuestas ni decisiones). */
  backToLobby: () => Promise<void>;
}

// Derivados (no almacenados). Reciben el estado de la sala y lo que necesiten de fuera.
export const selectIsHost = (s: Pick<RoomState, 'hostId'>, currentUserId: string): boolean =>
  s.hostId !== null && s.hostId === currentUserId;
export const isMemberHost = (s: Pick<RoomState, 'hostId'>, m: Pick<RoomMember, 'userId'>): boolean =>
  m.userId === s.hostId;
export const selectAllReady = (s: Pick<RoomState, 'members'>): boolean =>
  s.members.length >= 2 && s.members.every((m) => m.isReady);
export const selectFreeSlots = (s: Pick<RoomState, 'members'>): number =>
  MAX_ROOM_MEMBERS - s.members.length;
/** Todas las preguntas del banco Intermedio tienen respuesta no vacia. */
export const selectMoodComplete = (s: Pick<RoomState, 'mood'>): boolean =>
  QUESTIONS_BY_COMPLEXITY.intermedio.every((q) => (s.mood.answers[q] ?? '') !== '');
export const selectGroupFilters = (
  s: Pick<RoomState, 'mood'>,
  favoritePlatforms: string[],
): MoodFilters => ({ answers: s.mood.answers, fallbackPlatforms: favoritePlatforms });

const EMPTY_MOOD: GroupMoodState = { answers: {}, confirmed: false };

const CLEAN = {
  code: null,
  hostId: null,
  members: [] as RoomMember[],
  phase: 'lobby' as RoomPhase,
  mood: EMPTY_MOOD,
  deck: [] as MediaRef[],
  decisions: [] as GroupDecision[],
  status: 'idle' as const,
  error: null,
};

let unsubscribers: Array<() => void> = [];
const dropSubscriptions = () => {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
};

const upsertDecision = (list: GroupDecision[], d: GroupDecision): GroupDecision[] => [
  ...list.filter((x) => !(x.userId === d.userId && x.key === d.key)),
  d,
];

class StoreRoomError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'RoomError';
    this.code = code;
  }
}

export const useRoomStore = create<RoomState>()((set, get) => {
  const me = () => useProfileStore.getState().profile;
  const applySnapshot = (snap: RoomSnapshot) =>
    set({ hostId: snap.hostId, members: snap.members, phase: snap.phase, mood: snap.mood, deck: snap.deck ?? [] });
  const connect = (code: string) => {
    dropSubscriptions();
    unsubscribers = [
      roomRepository.subscribe(code, applySnapshot),
      roomRepository.subscribeDecisions(code, (d) =>
        set((s) => ({ decisions: upsertDecision(s.decisions, d) })),
      ),
    ];
  };
  const requireHost = () => {
    const { hostId, code } = get();
    if (!code) throw new StoreRoomError('not-found');
    if (hostId !== me().id) throw new StoreRoomError('not-host');
    return code;
  };

  return {
    ...CLEAN,
    createRoom: async () => {
      const user = me();
      if (get().code) get().leaveRoom();
      set({ ...CLEAN, status: 'joining' });
      try {
        const code = await roomRepository.createRoom(user.id);
        const snap = await roomRepository.joinRoom(code, { userId: user.id, name: user.displayName });
        connect(code);
        set({ code, status: 'active', error: null });
        applySnapshot(snap);
        return code;
      } catch (e) {
        set({ ...CLEAN, status: 'error', error: 'not-found' });
        throw e;
      }
    },
    joinRoom: async (rawCode) => {
      const code = rawCode.trim().toUpperCase();
      const user = me();
      if (get().code && get().code !== code) get().leaveRoom();
      set({ status: 'joining', error: null });
      try {
        const snap = await roomRepository.joinRoom(code, { userId: user.id, name: user.displayName });
        connect(code);
        set({ code, decisions: [], status: 'active', error: null });
        applySnapshot(snap);
        return true;
      } catch (e) {
        const error: RoomStoreErrorCode = (e as { code?: string }).code === 'full' ? 'full' : 'not-found';
        set({ ...CLEAN, status: 'error', error });
        return false;
      }
    },
    setReady: (ready) => {
      const { code } = get();
      if (!code) return;
      const id = me().id;
      set((s) => ({ members: s.members.map((m) => (m.userId === id ? { ...m, isReady: ready } : m)) }));
      void roomRepository.setReady(code, id, ready);
    },
    leaveRoom: () => {
      const { code } = get();
      dropSubscriptions();
      if (code) roomRepository.leaveRoom?.(code, me().id);
      set({ ...CLEAN });
    },
    startMatch: async () => {
      const code = requireHost();
      await roomRepository.startMatch(code, me().id);
    },
    setMoodAnswer: async (questionId, answerId) => {
      const code = requireHost();
      if (get().phase !== 'mood') throw new StoreRoomError('wrong-phase');
      set((s) => ({ mood: { ...s.mood, answers: { ...s.mood.answers, [questionId]: answerId } } }));
      await roomRepository.setMoodAnswer(code, me().id, questionId, answerId);
    },
    confirmMood: async () => {
      const code = requireHost();
      if (!selectMoodComplete(get())) throw new StoreRoomError('mood-incomplete');
      let deck: MediaRef[] | undefined;
      if (roomRepository.getGroupSeenKeys) {
        const exclude = new Set(await roomRepository.getGroupSeenKeys(code));
        const filters = selectGroupFilters(get(), useProfileStore.getState().profile.favoritePlatforms);
        const movies = await catalogRepository.getGroupDeck({ excludeKeys: exclude, filters, count: GROUP_DECK_COUNT });
        deck = movies.map((m) => ({ mediaType: 'movie', mediaId: m.id }));
      }
      await roomRepository.confirmMood(code, me().id, deck);
    },
    submitDecision: async (key, decision) => {
      const { code } = get();
      if (!code) throw new StoreRoomError('not-found');
      const userId = me().id;
      set((s) => ({ decisions: upsertDecision(s.decisions, { userId, key, decision }) }));
      await roomRepository.submitDecision(code, userId, key, decision);
    },
    backToLobby: async () => {
      const { code } = get();
      if (!code) return;
      set({ decisions: [], mood: EMPTY_MOOD });
      await roomRepository.backToLobby?.(code);
    },
  };
});
