import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, SEEDED_ROOM_CODE } from '@/constants/room';
import { createFakeRoom, type FakeRoom } from '@/__tests__/__mockFakeSocket';
import { useProfileStore } from '@/store/useProfileStore';
import { RoomError, type RoomErrorCode } from './room.errors';

// RoomError vive en `room.errors` (P5); se re-exporta desde aqui por compatibilidad.
export { RoomError };
export type { RoomErrorCode };

export type { RoomSnapshot } from '@/types/room';

// P9: el tipo se exportó a room.types.ts; se mantiene el export aquí para compatibilidad
// (se borra este fichero en P9).
import type { RoomRepository } from './room.types';
export type { RoomRepository } from './room.types';

const rooms = new Map<string, FakeRoom>();

function seedRooms(): void {
  rooms.set(SEEDED_ROOM_CODE, createFakeRoom(SEEDED_ROOM_CODE, 'B'));
}
seedRooms();

/** Solo tests: cierra todas las salas y restaura la sembrada. */
export function resetMockRooms(): void {
  rooms.forEach((r) => r.cleanup());
  rooms.clear();
  seedRooms();
}

const normalize = (code: string) => code.trim().toUpperCase();

function getRoom(code: string): FakeRoom {
  const room = rooms.get(normalize(code));
  if (!room) throw new RoomError('not-found');
  return room;
}

function newCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET.charAt(Math.floor(Math.random() * ROOM_CODE_ALPHABET.length));
    }
    if (!rooms.has(code)) return code;
  }
}

export const roomRepository: RoomRepository = {
  async createRoom(hostId, affinity) {
    const code = newCode();
    const { profile } = useProfileStore.getState();
    const name = profile.id === hostId ? profile.displayName : 'Anfitrión';
    rooms.set(code, createFakeRoom(code, 'A', { host: { userId: hostId, name }, affinity }));
    return code;
  },
  async joinRoom(code, user) {
    return getRoom(code).join(user);
  },
  async setReady(code, userId, ready) {
    getRoom(code).setReady(userId, ready);
  },
  async startMatch(code, userId) {
    getRoom(code).startMatch(userId);
  },
  async setMoodAnswer(code, userId, questionId, answerId) {
    getRoom(code).setMoodAnswer(userId, questionId, answerId);
  },
  async confirmMood(code, userId) {
    getRoom(code).confirmMood(userId);
  },
  async submitDecision(code, userId, key, decision) {
    getRoom(code).submitDecision(userId, key, decision);
  },
  subscribe(code, cb) {
    return rooms.get(normalize(code))?.subscribe(cb) ?? (() => {});
  },
  subscribeDecisions(code, cb) {
    return rooms.get(normalize(code))?.subscribeDecisions(cb) ?? (() => {});
  },
  beginSwipe(code, deck) {
    rooms.get(normalize(code))?.beginSwipe(deck);
  },
  leaveRoom(code, userId) {
    const key = normalize(code);
    const room = rooms.get(key);
    if (!room) return;
    room.leave(userId);
    if (!room.hasNoRealMembers()) return;
    room.cleanup();
    rooms.delete(key);
    if (key === SEEDED_ROOM_CODE) rooms.set(key, createFakeRoom(key, 'B'));
  },
  async backToLobby(code) {
    getRoom(code).backToLobby();
  },
};
