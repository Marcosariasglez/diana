import { ROUTES } from '@/constants/routes';
import { GROUP_DECK_COUNT, SEEDED_ROOM_CODE } from '@/constants/room';
import { MOCK_HOST_MOOD_ANSWERS, MOCK_TIMELINE } from '@/mocks/fakeSocket';
import { catalogRepository } from '@/services/catalog.repository';
import { resetMockRooms } from '@/services/room.repository';
import { createDefaultProfile, useProfileStore } from '@/store/useProfileStore';
import { selectGroupFilters, selectMoodComplete, useRoomStore } from '@/store/useRoomStore';
import { loadGroupDeck } from './useGroupSwipe';
import { selectedOptions, toggleMultiAnswer } from './useGroupMood';
import { getQuestionsFor } from '@/features/mood/questions';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

const ANSWERS = [
  ['time', 'h2'],
  ['energy', 'calm'],
  ['company', 'friends'],
  ['platforms', 'netflix,max'],
] as const;

beforeEach(() => {
  jest.useFakeTimers();
  useProfileStore.setState({ profile: createDefaultProfile() });
});

afterEach(() => {
  useRoomStore.getState().leaveRoom();
  resetMockRooms();
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('Mood de grupo: solo el anfitrion', () => {
  it('setMoodAnswer y confirmMood rechazan con not-host si el usuario no es anfitrion', async () => {
    await useRoomStore.getState().joinRoom(SEEDED_ROOM_CODE);
    await expect(useRoomStore.getState().setMoodAnswer('time', 'h2')).rejects.toThrow('not-host');
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('not-host');
  });

  it('confirmMood rechaza si !moodComplete y se acepta al completar las 4 preguntas', async () => {
    await useRoomStore.getState().createRoom();
    await useRoomStore.getState().startMatch();
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('mood-incomplete');
    for (const [q, a] of ANSWERS.slice(0, 3)) await useRoomStore.getState().setMoodAnswer(q, a);
    expect(selectMoodComplete(useRoomStore.getState())).toBe(false);
    await expect(useRoomStore.getState().confirmMood()).rejects.toThrow('mood-incomplete');
    await useRoomStore.getState().setMoodAnswer('platforms', 'netflix');
    await expect(useRoomStore.getState().confirmMood()).resolves.toBeUndefined();
    expect(useRoomStore.getState().phase).toBe('swipe');
  });

  it('setMoodAnswer fuera de la fase mood se rechaza', async () => {
    await useRoomStore.getState().createRoom();
    await expect(useRoomStore.getState().setMoodAnswer('time', 'h2')).rejects.toThrow('wrong-phase');
  });
});

describe('Mood de grupo: escenario B (invitado)', () => {
  it('el invitado ve las 4 respuestas llegar en orden y luego phase === swipe', async () => {
    await useRoomStore.getState().joinRoom(SEEDED_ROOM_CODE);
    const seen: string[][] = [];
    const phases: string[] = [];
    const unsub = useRoomStore.subscribe((s) => {
      const keys = Object.keys(s.mood.answers);
      if (keys.length > 0 && keys.length !== seen[seen.length - 1]?.length) seen.push(keys);
      if (phases[phases.length - 1] !== s.phase) phases.push(s.phase);
    });

    useRoomStore.getState().setReady(true);
    await jest.advanceTimersByTimeAsync(MOCK_TIMELINE.seededHostStartDelay);
    expect(useRoomStore.getState().phase).toBe('mood');
    await jest.advanceTimersByTimeAsync(60000);
    unsub();

    expect(seen.map((keys) => keys[keys.length - 1])).toEqual(['time', 'energy', 'company', 'platforms']);
    expect(useRoomStore.getState().mood.answers).toEqual(MOCK_HOST_MOOD_ANSWERS);
    expect(phases).toContain('mood');
    expect(useRoomStore.getState().phase).toBe('swipe');
    expect(useRoomStore.getState().mood.confirmed).toBe(true);
  });
});

describe('Mood de grupo: filtros hacia getGroupDeck', () => {
  it('groupFilters se pasa tal cual a getGroupDeck', async () => {
    const spy = jest.spyOn(catalogRepository, 'getGroupDeck');
    const mood = { answers: { time: 'h2', platforms: 'netflix,max' }, confirmed: true };
    const filters = selectGroupFilters({ mood }, ['netflix', 'prime-video']);
    expect(filters).toEqual({ answers: mood.answers, fallbackPlatforms: ['netflix', 'prime-video'] });

    const deck = await loadGroupDeck({
      members: [{ userId: 'user-me' }, { userId: 'user-maria' }],
      userSeen: new Set(['movie:1']),
      filters,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.filters).toBe(filters);
    expect(arg.count).toBe(GROUP_DECK_COUNT);
    expect(arg.excludeKeys.has('movie:1')).toBe(true);
    expect(deck.length).toBeLessThanOrEqual(GROUP_DECK_COUNT);
    for (const m of deck) expect(arg.excludeKeys.has(`movie:${m.id}`)).toBe(false);
  });
});

describe('Mood de grupo: ayudas de seleccion y manifiesto', () => {
  it('toggleMultiAnswer anade y quita ids', () => {
    expect(toggleMultiAnswer(undefined, 'netflix')).toBe('netflix');
    expect(toggleMultiAnswer('netflix', 'max')).toBe('netflix,max');
    expect(toggleMultiAnswer('netflix,max', 'netflix')).toBe('max');
    expect(toggleMultiAnswer('max', 'max')).toBe('');
  });

  it('selectedOptions resuelve respuestas simples y multiples', () => {
    const [time, , , platforms] = getQuestionsFor('intermedio');
    expect(selectedOptions(time, 'h2').map((o) => o.id)).toEqual(['h2']);
    expect(selectedOptions(platforms, 'netflix,max').map((o) => o.id)).toEqual(['netflix', 'max']);
    expect(selectedOptions(time, undefined)).toEqual([]);
  });

  it('la ruta /room/[code]/mood esta en el manifiesto de rutas', () => {
    const route = ROUTES.find((r) => r.url === '/room/[code]/mood');
    expect(route?.file).toBe('app/room/[code]/mood.tsx');
    expect(route?.bottomNav).toBe(false);
  });
});
