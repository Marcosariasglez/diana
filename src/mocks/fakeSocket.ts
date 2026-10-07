import type { Media } from '@/types/media';
import type { MediaKey } from '@/types/rating';
import type { GroupDecision, GroupMoodState, RoomMember, RoomPhase, RoomSnapshot } from '@/types/room';
import { MAX_ROOM_MEMBERS } from '@/constants/room';
import { QUESTIONS_BY_COMPLEXITY } from '@/features/mood/questions';
import { FAKE_USERS, type FakeUser } from '@/mocks/data/fakeUsers';
import { mediaKeyOf } from '@/mocks/data/catalog';
import { decisionFromTenths, friendDecisionDelayMs, friendTaste } from '@/mocks/mock-ai/friends';
import { predictTenths } from '@/mocks/mock-ai/predict';

export const MOCK_TIMELINE = {
  joinMaria: 2000,
  joinCarlos: 5000,
  readyCarlos: 8000,
  joinAna: 12000,
  readyAna: 15000,
  seededHostStartDelay: 2000,
  hostMoodFirstAnswer: 1000,
  hostMoodStep: 1500,
  hostMoodConfirmDelay: 1500,
  friendPaceMs: 2500,
} as const;

export type Timeline = { -readonly [K in keyof typeof MOCK_TIMELINE]: number };

export const MOCK_HOST_MOOD_ANSWERS = {
  time: 'h2',
  energy: 'calm',
  company: 'friends',
  platforms: 'netflix,max',
} as const;

export type FakeRoomScenario = 'A' | 'B';
export type RoomErrorCode = 'not-found' | 'full' | 'not-host' | 'wrong-phase';

/** Error de sala: `message` y `code` son el mismo codigo. */
export class RoomError extends Error {
  readonly code: RoomErrorCode;
  constructor(code: RoomErrorCode) {
    super(code);
    this.name = 'RoomError';
    this.code = code;
  }
}

export interface FakeRoomUser {
  userId: string;
  name: string;
}

export interface FakeRoomOptions {
  /** Escenario A: anfitrion (usuario actual). Obligatorio en A. */
  host?: FakeRoomUser;
  /** Sustituible por ceros en tests. */
  timeline?: Timeline;
}

export interface FakeRoom {
  readonly code: string;
  readonly scenario: FakeRoomScenario;
  getSnapshot(): RoomSnapshot;
  join(user: FakeRoomUser): RoomSnapshot;
  leave(userId: string): void;
  /** true si ya no quedan personas reales (solo amigos mock). */
  hasNoRealMembers(): boolean;
  setReady(userId: string, ready: boolean): void;
  startMatch(userId: string): void;
  setMoodAnswer(userId: string, questionId: string, answerId: string): void;
  confirmMood(userId: string): void;
  backToLobby(): void;
  submitDecision(userId: string, key: MediaKey, decision: 'like' | 'skip'): void;
  /** SOLO MOCK: programa las decisiones de los amigos presentes. Idempotente. */
  beginSwipe(deck: ReadonlyArray<Media>): void;
  subscribe(cb: (s: RoomSnapshot) => void): () => void;
  subscribeDecisions(cb: (d: GroupDecision) => void): () => void;
  cleanup(): void;
}

const FRIEND_BY_ID = new Map<string, FakeUser>(FAKE_USERS.map((u) => [u.userId, u]));
const friend = (id: string): FakeUser => FRIEND_BY_ID.get(id) as FakeUser;

const toMember = (u: FakeRoomUser | FakeUser, isReady: boolean): RoomMember => ({
  userId: u.userId,
  name: u.name,
  initial: ('initial' in u ? u.initial : u.name.charAt(0).toUpperCase()) || '?',
  isReady,
});

export function createFakeRoom(
  code: string,
  scenario: FakeRoomScenario,
  options: FakeRoomOptions = {},
): FakeRoom {
  const timeline = options.timeline ?? MOCK_TIMELINE;
  const maria = friend('user-maria');
  const carlos = friend('user-carlos');
  const ana = friend('user-ana');

  let hostId: string;
  let members: RoomMember[];
  if (scenario === 'A') {
    if (!options.host) throw new Error('createFakeRoom: el escenario A requiere host');
    hostId = options.host.userId;
    members = [toMember(options.host, true)];
  } else {
    hostId = maria.userId;
    members = [toMember(maria, true), toMember(carlos, true)];
  }

  let phase: RoomPhase = 'lobby';
  let mood: GroupMoodState = { answers: {}, confirmed: false };
  let swipeBegun = false;
  let hostStartScheduled = false;
  let closed = false;
  const listeners = new Set<(s: RoomSnapshot) => void>();
  const decisionListeners = new Set<(d: GroupDecision) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const schedule = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!closed) fn();
    }, ms);
    timers.add(t);
  };

  const snapshot = (): RoomSnapshot => ({
    hostId,
    members: members.map((m) => ({ ...m })),
    phase,
    mood: { answers: { ...mood.answers }, confirmed: mood.confirmed },
  });
  const emit = () => {
    const s = snapshot();
    listeners.forEach((cb) => cb(s));
  };
  const emitDecision = (d: GroupDecision) => decisionListeners.forEach((cb) => cb(d));

  const allReady = () => members.length >= 2 && members.every((m) => m.isReady);
  const assertHost = (userId: string) => {
    if (userId !== hostId) throw new RoomError('not-host');
  };
  const assertPhase = (expected: RoomPhase) => {
    if (phase !== expected) throw new RoomError('wrong-phase');
  };

  const addMember = (u: FakeRoomUser | FakeUser, ready: boolean): boolean => {
    if (members.some((m) => m.userId === u.userId)) return true;
    if (members.length >= MAX_ROOM_MEMBERS) return false;
    members = [...members, toMember(u, ready)];
    return true;
  };
  const markReady = (userId: string, ready: boolean) => {
    members = members.map((m) => (m.userId === userId ? { ...m, isReady: ready } : m));
  };

  const intermedio = QUESTIONS_BY_COMPLEXITY.intermedio;

  const applyMoodAnswer = (questionId: string, answerId: string) => {
    mood = { ...mood, answers: { ...mood.answers, [questionId]: answerId } };
  };
  const applyConfirm = () => {
    mood = { ...mood, confirmed: true };
    phase = 'swipe';
  };

  /** Escenario B: el anfitrion simulado responde las 4 preguntas y confirma. */
  const runHostMood = () => {
    intermedio.forEach((qid, i) => {
      schedule(timeline.hostMoodFirstAnswer + i * timeline.hostMoodStep, () => {
        applyMoodAnswer(qid, MOCK_HOST_MOOD_ANSWERS[qid as keyof typeof MOCK_HOST_MOOD_ANSWERS]);
        emit();
      });
    });
    const last = timeline.hostMoodFirstAnswer + (intermedio.length - 1) * timeline.hostMoodStep;
    schedule(last + timeline.hostMoodConfirmDelay, () => {
      applyConfirm();
      emit();
    });
  };

  /** Escenario B: cuando todos estan listos, el anfitrion simulado inicia. */
  const evaluate = () => {
    if (scenario !== 'B' || phase !== 'lobby' || hostStartScheduled || !allReady()) return;
    hostStartScheduled = true;
    schedule(timeline.seededHostStartDelay, () => {
      hostStartScheduled = false;
      if (phase !== 'lobby' || !allReady()) return;
      phase = 'mood';
      emit();
      runHostMood();
    });
  };

  if (scenario === 'A') {
    schedule(timeline.joinMaria, () => {
      if (addMember(maria, true)) emit();
    });
    schedule(timeline.joinCarlos, () => {
      if (addMember(carlos, false)) emit();
    });
    schedule(timeline.readyCarlos, () => {
      markReady(carlos.userId, true);
      emit();
    });
    schedule(timeline.joinAna, () => {
      if (addMember(ana, false)) emit();
    });
    schedule(timeline.readyAna, () => {
      markReady(ana.userId, true);
      emit();
    });
  }

  return {
    code,
    scenario,
    getSnapshot: snapshot,
    join(user) {
      if (!addMember(user, false)) throw new RoomError('full');
      emit();
      evaluate();
      return snapshot();
    },
    leave(userId) {
      members = members.filter((m) => m.userId !== userId);
      emit();
    },
    hasNoRealMembers: () => members.every((m) => FRIEND_BY_ID.has(m.userId)),
    setReady(userId, ready) {
      markReady(userId, ready);
      emit();
      evaluate();
    },
    startMatch(userId) {
      assertHost(userId);
      assertPhase('lobby');
      phase = 'mood';
      emit();
    },
    setMoodAnswer(userId, questionId, answerId) {
      assertHost(userId);
      assertPhase('mood');
      applyMoodAnswer(questionId, answerId);
      emit();
    },
    confirmMood(userId) {
      assertHost(userId);
      assertPhase('mood');
      applyConfirm();
      emit();
    },
    backToLobby() {
      phase = 'lobby';
      mood = { answers: {}, confirmed: false };
      swipeBegun = false;
      hostStartScheduled = false;
      members = members.map((m) => ({
        ...m,
        isReady: m.userId === hostId || FRIEND_BY_ID.has(m.userId),
      }));
      emit();
    },
    submitDecision(userId, key, decision) {
      emitDecision({ userId, key, decision });
    },
    beginSwipe(deck) {
      if (swipeBegun) return;
      swipeBegun = true;
      for (const m of members) {
        const f = FRIEND_BY_ID.get(m.userId);
        if (!f) continue;
        const taste = friendTaste(f);
        deck.forEach((media, i) => {
          const key = mediaKeyOf(media);
          const decision = decisionFromTenths(predictTenths(taste, media, key));
          schedule((i + 1) * timeline.friendPaceMs + friendDecisionDelayMs(f, key), () =>
            emitDecision({ userId: f.userId, key, decision }),
          );
        });
      }
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    subscribeDecisions(cb) {
      decisionListeners.add(cb);
      return () => {
        decisionListeners.delete(cb);
      };
    },
    cleanup() {
      closed = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      listeners.clear();
      decisionListeners.clear();
    },
  };
}
