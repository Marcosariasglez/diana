// D2-4: bandeja de avisos. Un aviso vivo por título (refresh, no duplicado),
// marcar leídos, limpieza por claves (títulos fuera de la watchlist), tope
// de avisos y persistencia solo de `notices`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationTrayStore, selectUnreadCount, type TrayNotice } from './useNotificationTrayStore';

const n = (over: Partial<Omit<TrayNotice, 'read'>> = {}) => ({
  id: 'movie:1',
  mediaType: 'movie' as const,
  mediaId: 1,
  newPlatforms: ['netflix'],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('useNotificationTrayStore (D2-4)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useNotificationTrayStore.getState().clear();
  });

  it('add crea el aviso como no leído y al inicio de la lista', () => {
    useNotificationTrayStore.getState().add(n());
    const s = useNotificationTrayStore.getState();
    expect(s.notices).toHaveLength(1);
    expect(s.notices[0].read).toBe(false);
    expect(selectUnreadCount(s)).toBe(1);
  });

  it('add del mismo título refresca (no duplica) y lo pasa a no leído', () => {
    useNotificationTrayStore.getState().add(n({ newPlatforms: ['netflix'] }));
    useNotificationTrayStore.getState().markAllRead();
    useNotificationTrayStore.getState().add(n({ newPlatforms: ['netflix', 'max'] }));
    const s = useNotificationTrayStore.getState();
    expect(s.notices).toHaveLength(1);
    expect(s.notices[0].newPlatforms).toEqual(['netflix', 'max']);
    expect(s.notices[0].read).toBe(false);
  });

  it('distingue (movie,1) de (tv,1)', () => {
    useNotificationTrayStore.getState().add(n());
    useNotificationTrayStore.getState().add(n({ id: 'tv:1', mediaType: 'tv' }));
    expect(useNotificationTrayStore.getState().notices).toHaveLength(2);
  });

  it('markAllRead solo toca los no leídos', () => {
    useNotificationTrayStore.getState().add(n());
    useNotificationTrayStore.getState().markAllRead();
    const s = useNotificationTrayStore.getState();
    expect(s.notices[0].read).toBe(true);
    expect(selectUnreadCount(s)).toBe(0);
  });

  it('removeForKeys descarta los avisos de títulos fuera de la watchlist', () => {
    useNotificationTrayStore.getState().add(n());
    useNotificationTrayStore.getState().add(n({ id: 'movie:2', mediaId: 2 }));
    useNotificationTrayStore.getState().removeForKeys(new Set(['movie:2']));
    const s = useNotificationTrayStore.getState();
    expect(s.notices.map((x) => x.id)).toEqual(['movie:1']);
  });

  it('limita la bandeja a 50 avisos (los más recientes al inicio)', () => {
    const add = useNotificationTrayStore.getState().add;
    for (let i = 0; i < 55; i++) add(n({ id: `movie:${i}`, mediaId: i }));
    const s = useNotificationTrayStore.getState();
    expect(s.notices).toHaveLength(50);
    // El último añadido (movie:54) está al inicio.
    expect(s.notices[0].id).toBe('movie:54');
  });

  it('persistencia: clave diana.notifications.v1, version 1, solo notices', () => {
    const store = useNotificationTrayStore as unknown as {
      persist: { getOptions: () => { name: string; version: number; partialize: (s: unknown) => unknown } };
    };
    const options = store.persist.getOptions();
    expect(options.name).toBe('diana.notifications.v1');
    expect(options.version).toBe(1);
    useNotificationTrayStore.getState().add(n());
    const partial = options.partialize(useNotificationTrayStore.getState()) as Record<string, unknown>;
    expect(Object.keys(partial).sort()).toEqual(['notices']);
  });

  it('escribe en AsyncStorage al añadir', async () => {
    useNotificationTrayStore.getState().add(n());
    await Promise.resolve();
    const raw = (await AsyncStorage.getItem('diana.notifications.v1')) as string;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.state.notices).toHaveLength(1);
  });
});
