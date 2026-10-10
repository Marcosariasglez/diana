// D2-3: store local de «Quiero ver». Estado simple (items) + acciones de
// alta/baja/toggle con deduplicación por (mediaType, mediaId). La clave de
// persistencia debe ser estable (diana.watchlist.v1) para no perder la lista
// al actualizar la app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWatchlistStore } from './useWatchlistStore';

describe('useWatchlistStore (D2-3)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useWatchlistStore.getState().setItems([]);
  });

  it('parte vacío: has() false y items []', () => {
    const s = useWatchlistStore.getState();
    expect(s.items).toEqual([]);
    expect(s.has('movie', 1)).toBe(false);
  });

  it('add añade con addedAt ISO y has() pasa a true', () => {
    const before = Date.now();
    useWatchlistStore.getState().add('movie', 7);
    const s = useWatchlistStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].mediaType).toBe('movie');
    expect(s.items[0].mediaId).toBe(7);
    const ts = Date.parse(s.items[0].addedAt);
    expect(Number.isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(Date.now() + 1000);
    expect(s.has('movie', 7)).toBe(true);
  });

  it('add duplicado NO duplica la fila (ni cambia addedAt)', () => {
    useWatchlistStore.getState().add('tv', 3);
    const first = useWatchlistStore.getState().items[0];
    useWatchlistStore.getState().add('tv', 3);
    const s = useWatchlistStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].addedAt).toBe(first.addedAt);
  });

  it('add distingue (movie,5) de (tv,5)', () => {
    useWatchlistStore.getState().add('movie', 5);
    useWatchlistStore.getState().add('tv', 5);
    expect(useWatchlistStore.getState().items).toHaveLength(2);
  });

  it('remove quita solo la pareja exacta', () => {
    useWatchlistStore.getState().add('movie', 5);
    useWatchlistStore.getState().add('tv', 5);
    useWatchlistStore.getState().remove('movie', 5);
    const s = useWatchlistStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].mediaType).toBe('tv');
    expect(s.has('movie', 5)).toBe(false);
    expect(s.has('tv', 5)).toBe(true);
  });

  it('remove de algo que no existe no rompe el estado', () => {
    useWatchlistStore.getState().add('movie', 1);
    useWatchlistStore.getState().remove('movie', 999);
    expect(useWatchlistStore.getState().items).toHaveLength(1);
  });

  it('toggle añade y luego quita', () => {
    useWatchlistStore.getState().toggle('movie', 9);
    expect(useWatchlistStore.getState().has('movie', 9)).toBe(true);
    useWatchlistStore.getState().toggle('movie', 9);
    expect(useWatchlistStore.getState().has('movie', 9)).toBe(false);
    expect(useWatchlistStore.getState().items).toEqual([]);
  });

  it('setItems sobrescribe (hidratación desde el servidor)', () => {
    useWatchlistStore.getState().add('movie', 1);
    useWatchlistStore.getState().setItems([
      { mediaType: 'tv', mediaId: 42, addedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const s = useWatchlistStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].mediaId).toBe(42);
    expect(s.has('movie', 1)).toBe(false);
  });

  it('persistencia: clave diana.watchlist.v1, version 1, partialize solo items', () => {
    const store = useWatchlistStore as unknown as {
      persist: { getOptions: () => { name: string; version: number; partialize: (s: any) => unknown } };
    };
    const options = store.persist.getOptions();
    expect(options.name).toBe('diana.watchlist.v1');
    expect(options.version).toBe(1);
    useWatchlistStore.getState().add('movie', 2);
    const partial = options.partialize(useWatchlistStore.getState()) as Record<string, unknown>;
    expect(Object.keys(partial).sort()).toEqual(['items']);
  });

  it('escribe la lista particionada en AsyncStorage al cambiar el estado', async () => {
    useWatchlistStore.getState().add('movie', 6);
    await Promise.resolve();
    const raw = (await AsyncStorage.getItem('diana.watchlist.v1')) as string;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.state.items).toHaveLength(1);
    expect(parsed.state.items[0].mediaId).toBe(6);
    expect(parsed.state).not.toHaveProperty('add');
  });
});
