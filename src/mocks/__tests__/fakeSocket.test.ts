import type { GroupDecision, RoomSnapshot } from '@/types/room';
import { CATALOG, mediaKeyOf } from '@/mocks/data/catalog';
import { friendDecision, friendDecisionDelayMs } from '@/mocks/mock-ai/friends';
import { FAKE_USERS } from '@/mocks/data/fakeUsers';
import {
  createFakeRoom,
  MOCK_HOST_MOOD_ANSWERS,
  MOCK_TIMELINE,
  RoomError,
  type Timeline,
} from '../fakeSocket';

const ME = { userId: 'user-me', name: 'Juan' };
const ZERO: Timeline = {
  joinMaria: 0,
  joinCarlos: 0,
  readyCarlos: 0,
  joinAna: 0,
  readyAna: 0,
  seededHostStartDelay: 0,
  hostMoodFirstAnswer: 0,
  hostMoodStep: 0,
  hostMoodConfirmDelay: 0,
  friendPaceMs: 0,
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('fakeSocket escenario B (sala sembrada)', () => {
  it('F7 tras seededHostStartDelay aparece mood; tras 4 respuestas y hostMoodConfirmDelay, swipe', () => {
    const room = createFakeRoom('X49B', 'B');
    const snaps: RoomSnapshot[] = [];
    room.subscribe((s) => snaps.push(s));

    const joined = room.join(ME);
    expect(joined.hostId).toBe('user-maria');
    expect(joined.members.map((m) => m.name)).toEqual(['María', 'Carlos', 'Juan']);
    room.setReady(ME.userId, true);
    expect(room.getSnapshot().phase).toBe('lobby');

    jest.advanceTimersByTime(MOCK_TIMELINE.seededHostStartDelay - 1);
    expect(room.getSnapshot().phase).toBe('lobby');
    jest.advanceTimersByTime(1);
    expect(room.getSnapshot().phase).toBe('mood');
    expect(room.getSnapshot().mood.answers).toEqual({});

    // Respuestas en orden, una por hostMoodStep desde hostMoodFirstAnswer.
    const order = ['time', 'energy', 'company', 'platforms'] as const;
    jest.advanceTimersByTime(MOCK_TIMELINE.hostMoodFirstAnswer);
    order.forEach((q, i) => {
      expect(Object.keys(room.getSnapshot().mood.answers)).toEqual(order.slice(0, i + 1));
      expect(room.getSnapshot().mood.answers[q]).toBe(MOCK_HOST_MOOD_ANSWERS[q]);
      if (i < order.length - 1) jest.advanceTimersByTime(MOCK_TIMELINE.hostMoodStep);
    });
    expect(room.getSnapshot().phase).toBe('mood');
    jest.advanceTimersByTime(MOCK_TIMELINE.hostMoodConfirmDelay - 1);
    expect(room.getSnapshot().phase).toBe('mood');
    jest.advanceTimersByTime(1);
    expect(room.getSnapshot().phase).toBe('swipe');
    expect(room.getSnapshot().mood.confirmed).toBe(true);
    // Cada respuesta emitio un snapshot nuevo (el invitado ve el resumen llenarse).
    const withAnswers = snaps.filter((s) => s.phase === 'mood' && Object.keys(s.mood.answers).length > 0);
    expect(withAnswers).toHaveLength(4);
    room.cleanup();
  });

  it('el anfitrion simulado no inicia mientras el usuario no este listo', () => {
    const room = createFakeRoom('X49B', 'B');
    room.join(ME);
    jest.advanceTimersByTime(60000);
    expect(room.getSnapshot().phase).toBe('lobby');
    room.cleanup();
  });

  it('un invitado no puede iniciar ni responder: not-host', () => {
    const room = createFakeRoom('X49B', 'B');
    room.join(ME);
    expect(() => room.startMatch(ME.userId)).toThrow(RoomError);
    expect(() => room.setMoodAnswer(ME.userId, 'time', 'h2')).toThrow('not-host');
    expect(() => room.confirmMood(ME.userId)).toThrow('not-host');
    room.cleanup();
  });

  it('con la linea de tiempo parametrizada a 0 el flujo ocurre con temporizadores 0', () => {
    const room = createFakeRoom('X49B', 'B', { timeline: ZERO });
    room.join(ME);
    room.setReady(ME.userId, true);
    jest.runOnlyPendingTimers(); // inicia
    jest.runOnlyPendingTimers(); // responde y confirma
    expect(room.getSnapshot().phase).toBe('swipe');
    room.cleanup();
  });
});

describe('fakeSocket escenario A (sala del usuario)', () => {
  it('entradas de amigos segun MOCK_TIMELINE', () => {
    const room = createFakeRoom('ABCD', 'A', { host: ME });
    const names = () => room.getSnapshot().members.map((m) => `${m.name}:${m.isReady ? 'L' : '-'}`);
    expect(names()).toEqual(['Juan:L']);
    jest.advanceTimersByTime(MOCK_TIMELINE.joinMaria);
    expect(names()).toEqual(['Juan:L', 'María:L']);
    jest.advanceTimersByTime(MOCK_TIMELINE.joinCarlos - MOCK_TIMELINE.joinMaria);
    expect(names()).toEqual(['Juan:L', 'María:L', 'Carlos:-']);
    jest.advanceTimersByTime(MOCK_TIMELINE.readyCarlos - MOCK_TIMELINE.joinCarlos);
    expect(names()).toEqual(['Juan:L', 'María:L', 'Carlos:L']);
    jest.advanceTimersByTime(MOCK_TIMELINE.joinAna - MOCK_TIMELINE.readyCarlos);
    expect(names()).toEqual(['Juan:L', 'María:L', 'Carlos:L', 'Ana:-']);
    jest.advanceTimersByTime(MOCK_TIMELINE.readyAna - MOCK_TIMELINE.joinAna);
    expect(names()).toEqual(['Juan:L', 'María:L', 'Carlos:L', 'Ana:L']);
    room.cleanup();
  });

  it('el anfitrion inicia, responde y confirma; fuera de fase se rechaza', () => {
    const room = createFakeRoom('ABCD', 'A', { host: ME });
    expect(() => room.setMoodAnswer(ME.userId, 'time', 'h2')).toThrow('wrong-phase');
    room.startMatch(ME.userId);
    expect(room.getSnapshot().phase).toBe('mood');
    room.setMoodAnswer(ME.userId, 'time', 'h2');
    room.confirmMood(ME.userId);
    expect(room.getSnapshot().phase).toBe('swipe');
    room.cleanup();
  });

  it('sala llena: la septima persona recibe full', () => {
    const room = createFakeRoom('ABCD', 'A', { host: ME });
    for (let i = 0; i < 5; i++) room.join({ userId: `g${i}`, name: `G${i}` });
    expect(() => room.join({ userId: 'g9', name: 'G9' })).toThrow('full');
    room.cleanup();
  });
});

describe('fakeSocket decisiones de los amigos (beginSwipe)', () => {
  it('programa una decision determinista por amigo y carta en t = (i + 1) * ritmo + retardo', () => {
    const room = createFakeRoom('X49B', 'B');
    room.join(ME);
    const deck = CATALOG.filter((m) => m.media_type === 'movie').slice(0, 3);
    const got: Array<GroupDecision & { at: number }> = [];
    let now = 0;
    room.subscribeDecisions((d) => got.push({ ...d, at: now + 1 }));
    room.beginSwipe(deck);
    room.beginSwipe(deck); // idempotente
    const maria = FAKE_USERS.find((u) => u.userId === 'user-maria')!;
    const end = 3 * MOCK_TIMELINE.friendPaceMs + 3000;
    for (; now < end; now += 1) jest.advanceTimersByTime(1);
    expect(got).toHaveLength(6); // Maria y Carlos x 3 cartas
    const key = mediaKeyOf(deck[0]);
    const first = got.find((d) => d.userId === maria.userId && d.key === key)!;
    expect(first.decision).toBe(friendDecision(maria, deck[0], key));
    expect(first.at).toBe(MOCK_TIMELINE.friendPaceMs + friendDecisionDelayMs(maria, key));
    room.cleanup();
  });

  it('las decisiones del usuario se emiten por subscribeDecisions', () => {
    const room = createFakeRoom('X49B', 'B');
    const got: GroupDecision[] = [];
    room.subscribeDecisions((d) => got.push(d));
    room.submitDecision('user-me', 'movie:1', 'like');
    expect(got).toEqual([{ userId: 'user-me', key: 'movie:1', decision: 'like' }]);
    room.cleanup();
  });
});

describe('fakeSocket cleanup', () => {
  it('F8 cleanup() no deja temporizadores pendientes', () => {
    const a = createFakeRoom('ABCD', 'A', { host: ME });
    const b = createFakeRoom('X49B', 'B');
    b.join(ME);
    b.setReady(ME.userId, true);
    b.beginSwipe(CATALOG.filter((m) => m.media_type === 'movie').slice(0, 5));
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    a.cleanup();
    b.cleanup();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('tras cleanup no se emiten mas snapshots', () => {
    const room = createFakeRoom('ABCD', 'A', { host: ME });
    const cb = jest.fn();
    room.subscribe(cb);
    room.cleanup();
    jest.advanceTimersByTime(60000);
    expect(cb).not.toHaveBeenCalled();
  });
});
