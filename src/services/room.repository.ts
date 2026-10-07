import type { Media } from '@/types/media';
import type { GroupDecision, RoomSnapshot } from '@/types/room';
import type { MediaKey } from '@/types/rating';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, SEEDED_ROOM_CODE } from '@/constants/room';
import { createFakeRoom, RoomError, type FakeRoom } from '@/mocks/fakeSocket';
import { fakeDelay } from '@/mocks/latency';
import { useProfileStore } from '@/store/useProfileStore';

export { RoomError } from '@/mocks/fakeSocket';
export type { RoomErrorCode } from '@/mocks/fakeSocket';

export type { RoomSnapshot } from '@/types/room';

export interface RoomRepository {
  createRoom(hostId: string): Promise<string>;
  /** Lanza RoomError con code 'not-found' | 'full'. Si ya es miembro, devuelve el estado actual. */
  joinRoom(code: string, user: { userId: string; name: string }): Promise<RoomSnapshot>;
  setReady(code: string, userId: string, ready: boolean): Promise<void>;
  startMatch(code: string, userId: string): Promise<void>;
  setMoodAnswer(code: string, userId: string, questionId: string, answerId: string): Promise<void>;
  confirmMood(code: string, userId: string, deck?: Array<{ mediaType: 'movie' | 'tv'; mediaId: number }>): Promise<void>;
  submitDecision(code: string, userId: string, key: MediaKey, decision: 'like' | 'skip'): Promise<void>;
  subscribe(code: string, cb: (s: RoomSnapshot) => void): () => void;
  subscribeDecisions(code: string, cb: (d: GroupDecision) => void): () => void;
  /** Solo existe en el repositorio real: clave de vistos del grupo. */
  getGroupSeenKeys?(code: string): Promise<string[]>;
  /** SOLO MOCK: programa las decisiones de los amigos (7.5). */
  beginSwipe?(code: string, deck: Media[]): void;
  /** Anadido (opcional): el miembro sale; libera temporizadores del mock. */
  leaveRoom?(code: string, userId: string): void;
  /** Anadido (opcional): vuelve la sala a la fase lobby ("Volver a la sala"). */
  backToLobby?(code: string): Promise<void>;
}

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
  async createRoom(hostId) {
    await fakeDelay();
    const code = newCode();
    const { profile } = useProfileStore.getState();
    const name = profile.id === hostId ? profile.displayName : 'Anfitrión';
    rooms.set(code, createFakeRoom(code, 'A', { host: { userId: hostId, name } }));
    return code;
  },
  async joinRoom(code, user) {
    await fakeDelay();
    return getRoom(code).join(user);
  },
  async setReady(code, userId, ready) {
    await fakeDelay();
    getRoom(code).setReady(userId, ready);
  },
  async startMatch(code, userId) {
    await fakeDelay();
    getRoom(code).startMatch(userId);
  },
  async setMoodAnswer(code, userId, questionId, answerId) {
    await fakeDelay();
    getRoom(code).setMoodAnswer(userId, questionId, answerId);
  },
  async confirmMood(code, userId) {
    await fakeDelay();
    getRoom(code).confirmMood(userId);
  },
  async submitDecision(code, userId, key, decision) {
    await fakeDelay();
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
    await fakeDelay();
    getRoom(code).backToLobby();
  },
};
