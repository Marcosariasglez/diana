import { SEEDED_ROOM_CODE } from '@/constants/room';
import { resetMockRooms, roomRepository } from '@/services/room.repository';
import { createDefaultProfile, useProfileStore } from './useProfileStore';
import {
  selectAllReady,
  selectFreeSlots,
  selectGroupFilters,
  selectIsHost,
  selectMoodComplete,
  useRoomStore,
} from './useRoomStore';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

const flush = async (ms: number) => {
  await jest.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  jest.useFakeTimers();
  useProfileStore.setState({ profile: createDefaultProfile() });
});

afterEach(() => {
  useRoomStore.getState().leaveRoom();
  resetMockRooms();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useRoomStore: crear sala (escenario A)', () => {
  it('createRoom: codigo de 4 caracteres, el usuario es anfitrion y esta listo', async () => {
    const code = await useRoomStore.getState().createRoom();
    const s = useRoomStore.getState();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(s.code).toBe(code);
    expect(s.status).toBe('active');
    expect(s.hostId).toBe('user-me');
    expect(selectIsHost(s, 'user-me')).toBe(true);
    expect(s.members).toEqual([{ userId: 'user-me', name: 'Juan', initial: 'J', isReady: true }]);
    expect(s.phase).toBe('lobby');
  });

  it('entran amigos mock: Maria a los 2 s (2 de 6), luego todos listos', async () => {
    await useRoomStore.getState().createRoom();
    await flush(2000);
    expect(useRoomStore.getState().members.map((m) => m.name)).toEqual(['Juan', 'María']);
    expect(selectFreeSlots(useRoomStore.getState())).toBe(4);
    expect(selectAllReady(useRoomStore.getState())).toBe(true);
    await flush(5000 - 2000);
    expect(useRoomStore.getState().members).toHaveLength(3);
    expect(selectAllReady(useRoomStore.getState())).toBe(false);
    await flush(15000 - 5000);
    const s = useRoomStore.getState();
    expect(s.members.map((m) => m.name)).toEqual(['Juan', 'María', 'Carlos', 'Ana']);
    expect(selectAllReady(s)).toBe(true);
  });

  it('startMatch del anfitrion pasa a mood; setMoodAnswer y confirmMood llegan a swipe', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    expect(useRoomStore.getState().phase).toBe('mood');
    for (const [q, a] of [
      ['time', 'h2'],
      ['energy', 'calm'],
      ['company', 'friends'],
      ['platforms', 'netflix'],
    ]) {
      await useRoomStore.getState().setMoodAnswer(q, a);
    }
    expect(selectMoodComplete(useRoomStore.getState())).toBe(true);
    await useRoomStore.getState().confirmMood();
    expect(useRoomStore.getState().phase).toBe('swipe');
    expect(useRoomStore.getState().mood.confirmed).toBe(true);
  });

  it('setReady actualiza al usuario actual', async () => {
    await useRoomStore.getState().createRoom();
    useRoomStore.getState().setReady(false);
    expect(useRoomStore.getState().members[0].isReady).toBe(false);
  });

  it('submitDecision guarda una decision por (usuario, carta)', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().submitDecision('movie:2', 'like');
    await useRoomStore.getState().submitDecision('movie:2', 'skip');
    expect(useRoomStore.getState().decisions).toEqual([{ userId: 'user-me', key: 'movie:2', decision: 'skip' }]);
  });

  it('backToLobby vuelve a lobby y limpia mood y decisiones', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    await useRoomStore.getState().setMoodAnswer('time', 'h2');
    await useRoomStore.getState().backToLobby();
    const s = useRoomStore.getState();
    expect(s.phase).toBe('lobby');
    expect(s.mood.answers).toEqual({});
    expect(s.decisions).toEqual([]);
  });

  it('leaveRoom limpia el estado y libera los temporizadores', async () => {
    await useRoomStore.getState().createRoom();
    useRoomStore.getState().leaveRoom();
    const s = useRoomStore.getState();
    expect(s.code).toBeNull();
    expect(s.status).toBe('idle');
    expect(s.members).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('useRoomStore: unirse (sala sembrada X49B y errores)', () => {
  it('joinRoom X49B (en minusculas): anfitrion Maria, el usuario entra como miembro no listo', async () => {
    const ok = await useRoomStore.getState().joinRoom('x49b');
    const s = useRoomStore.getState();
    expect(ok).toBe(true);
    expect(s.code).toBe(SEEDED_ROOM_CODE);
    expect(s.hostId).toBe('user-maria');
    expect(selectIsHost(s, 'user-me')).toBe(false);
    expect(s.members.map((m) => [m.name, m.isReady])).toEqual([
      ['María', true],
      ['Carlos', true],
      ['Juan', false],
    ]);
  });

  it('codigo inexistente: not-found', async () => {
    const ok = await useRoomStore.getState().joinRoom('ZZZZ');
    expect(ok).toBe(false);
    expect(useRoomStore.getState().error).toBe('not-found');
    expect(useRoomStore.getState().status).toBe('error');
    expect(useRoomStore.getState().code).toBeNull();
  });

  it('sala llena (6 de 6): full', async () => {
    for (let i = 0; i < 4; i++) {
      await roomRepository.joinRoom(SEEDED_ROOM_CODE, { userId: `guest-${i}`, name: `Invitado ${i}` });
    }
    const ok = await useRoomStore.getState().joinRoom(SEEDED_ROOM_CODE);
    expect(ok).toBe(false);
    expect(useRoomStore.getState().error).toBe('full');
  });

  it('el codigo de una sala creada localmente tambien es valido', async () => {
    const code = await useRoomStore.getState().createRoom();
    const snap = await roomRepository.joinRoom(code, { userId: 'guest-1', name: 'Invitado' });
    expect(snap.hostId).toBe('user-me');
  });

  it('un invitado no puede iniciar ni responder ni confirmar: not-host', async () => {
    await useRoomStore.getState().joinRoom(SEEDED_ROOM_CODE);
    await expect(useRoomStore.getState().startMatch()).rejects.toThrow('not-host');
    await expect(useRoomStore.getState().setMoodAnswer('time', 'h2')).rejects.toThrow('not-host');
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('not-host');
  });
});

describe('derivados', () => {
  it('allReady exige al menos 2 miembros', () => {
    expect(selectAllReady({ members: [{ userId: 'a', name: 'A', initial: 'A', isReady: true }] })).toBe(false);
  });

  it('groupFilters = respuestas del anfitrion + plataformas del perfil', () => {
    const mood = { answers: { time: 'h2' }, confirmed: false };
    expect(selectGroupFilters({ mood }, ['netflix'])).toEqual({
      answers: { time: 'h2' },
      fallbackPlatforms: ['netflix'],
    });
  });

  it('moodComplete falso con respuesta vacia', () => {
    const mood = { answers: { time: 'h2', energy: 'calm', company: 'friends', platforms: '' }, confirmed: false };
    expect(selectMoodComplete({ mood })).toBe(false);
  });
});
