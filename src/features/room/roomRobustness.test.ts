/**
 * D-5 · Robustez de salas: reconexión, doble envío, error de sync.
 *
 * Verifica que:
 * 1. submitDecision previene doble envío (misma key, segunda se ignora o sobrescribe)
 * 2. leaveRoom limpia estado y temporizadores
 * 3. joinRoom en sala llena devuelve false con error 'full'
 * 4. joinRoom con código inexistente devuelve false con error 'not-found'
 * 5. backToLobby limpia mood y decisiones
 */
import { SEEDED_ROOM_CODE } from '@/constants/room';
import { resetMockRooms, roomRepository } from '@/services/room.repository';
import { createDefaultProfile, useProfileStore } from '@/store/useProfileStore';
import { useRoomStore } from '@/store/useRoomStore';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

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

describe('Robustez: doble envío de decisión', () => {
  it('submitDecision con misma key sobrescribe la decisión anterior', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().submitDecision('movie:1', 'like');
    expect(useRoomStore.getState().decisions).toEqual([
      { userId: 'user-me', key: 'movie:1', decision: 'like' },
    ]);

    // Mismo usuario, misma carta, decisión diferente
    await useRoomStore.getState().submitDecision('movie:1', 'skip');
    expect(useRoomStore.getState().decisions).toEqual([
      { userId: 'user-me', key: 'movie:1', decision: 'skip' },
    ]);
  });

  it('submitDecision con key diferente se añade al array', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().submitDecision('movie:1', 'like');
    await useRoomStore.getState().submitDecision('movie:2', 'skip');
    expect(useRoomStore.getState().decisions).toEqual([
      { userId: 'user-me', key: 'movie:1', decision: 'like' },
      { userId: 'user-me', key: 'movie:2', decision: 'skip' },
    ]);
  });
});

describe('Robustez: limpieza de estado', () => {
  it('backToLobby limpia mood y decisiones', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    await useRoomStore.getState().setMoodAnswer('time', 'h2');
    await useRoomStore.getState().submitDecision('movie:1', 'like');

    await useRoomStore.getState().backToLobby();
    const s = useRoomStore.getState();
    expect(s.phase).toBe('lobby');
    expect(s.mood.answers).toEqual({});
    expect(s.mood.confirmed).toBe(false);
    expect(s.decisions).toEqual([]);
  });

  it('leaveRoom limpia todo el estado y libera temporizadores', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    await useRoomStore.getState().setMoodAnswer('time', 'h2');

    useRoomStore.getState().leaveRoom();
    const s = useRoomStore.getState();
    expect(s.code).toBeNull();
    expect(s.status).toBe('idle');
    expect(s.members).toEqual([]);
    expect(s.decisions).toEqual([]);
    expect(s.mood.answers).toEqual({});
    expect(s.mood.confirmed).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('Robustez: errores de sala', () => {
  it('joinRoom con código inexistente devuelve false con error not-found', async () => {
    const ok = await useRoomStore.getState().joinRoom('ZZZZ');
    expect(ok).toBe(false);
    expect(useRoomStore.getState().error).toBe('not-found');
    expect(useRoomStore.getState().status).toBe('error');
    expect(useRoomStore.getState().code).toBeNull();
  });

  it('joinRoom con sala llena (6/6) devuelve false con error full', async () => {
    // Rellenar sala sembrada (tiene 3 miembros)
    for (let i = 0; i < 4; i++) {
      await roomRepository.joinRoom(SEEDED_ROOM_CODE, {
        userId: `guest-${i}`,
        name: `Invitado ${i}`,
      });
    }
    const ok = await useRoomStore.getState().joinRoom(SEEDED_ROOM_CODE);
    expect(ok).toBe(false);
    expect(useRoomStore.getState().error).toBe('full');
  });

  it('invitado no puede startMatch ni setMoodAnswer ni confirmMood', async () => {
    await useRoomStore.getState().joinRoom(SEEDED_ROOM_CODE);
    await expect(useRoomStore.getState().startMatch()).rejects.toThrow('not-host');
    await expect(useRoomStore.getState().setMoodAnswer('time', 'h2')).rejects.toThrow('not-host');
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('not-host');
  });

  it('setMoodAnswer fuera de fase mood se rechaza', async () => {
    await useRoomStore.getState().createRoom();
    // Fase lobby
    await expect(useRoomStore.getState().setMoodAnswer('time', 'h2')).rejects.toThrow('wrong-phase');
  });
});

describe('Robustez: confirmMood exige mood completo', () => {
  it('confirmMood con respuestas incompletas se rechaza', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    // Solo 1 de 4 preguntas
    await useRoomStore.getState().setMoodAnswer('time', 'h2');
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('mood-incomplete');
  });

  it('confirmMood con respuesta vacía se rechaza', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    await useRoomStore.getState().setMoodAnswer('time', 'h2');
    await useRoomStore.getState().setMoodAnswer('energy', 'calm');
    await useRoomStore.getState().setMoodAnswer('company', 'friends');
    await useRoomStore.getState().setMoodAnswer('platforms', '');
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('mood-incomplete');
  });
});

describe('Robustez: setReady', () => {
  it('setReady actualiza el estado del usuario actual', async () => {
    await useRoomStore.getState().createRoom();
    expect(useRoomStore.getState().members[0].isReady).toBe(true);
    useRoomStore.getState().setReady(false);
    expect(useRoomStore.getState().members[0].isReady).toBe(false);
    useRoomStore.getState().setReady(true);
    expect(useRoomStore.getState().members[0].isReady).toBe(true);
  });
});
