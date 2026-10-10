// D2-3: store local de «Quiero ver». Estado (items) + cola de mutaciones
// pendientes (pendingAdds/pendingRemovals) + acciones de alta/baja/toggle con
// deduplicación por (mediaType, mediaId). La clave de persistencia debe ser
// estable (diana.watchlist.v1) para no perder la lista al actualizar la app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWatchlistStore } from './useWatchlistStore';

describe('useWatchlistStore (D2-3)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useWatchlistStore.getState().setItems([]);
    useWatchlistStore.getState().clearPending();
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

  it('persistencia: clave diana.watchlist.v1, version 2, partialize items+cola', () => {
    const store = useWatchlistStore as unknown as {
      persist: { getOptions: () => { name: string; version: number; partialize: (s: any) => unknown } };
    };
    const options = store.persist.getOptions();
    expect(options.name).toBe('diana.watchlist.v1');
    expect(options.version).toBe(2);
    useWatchlistStore.getState().add('movie', 2);
    const partial = options.partialize(useWatchlistStore.getState()) as Record<string, unknown>;
    expect(Object.keys(partial).sort()).toEqual(['items', 'pendingAdds', 'pendingRemovals']);
  });

  it('escribe la lista particionada en AsyncStorage al cambiar el estado', async () => {
    useWatchlistStore.getState().add('movie', 6);
    await Promise.resolve();
    const raw = (await AsyncStorage.getItem('diana.watchlist.v1')) as string;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.state.items).toHaveLength(1);
    expect(parsed.state.items[0].mediaId).toBe(6);
    expect(parsed.state).not.toHaveProperty('add');
  });

  it('add deja la alta pendiente hasta que markPushed la confirma', () => {
    useWatchlistStore.getState().add('movie', 8);
    expect(useWatchlistStore.getState().pendingAdds).toHaveLength(1);
    useWatchlistStore.getState().markPushed('movie', 8);
    expect(useWatchlistStore.getState().pendingAdds).toHaveLength(0);
  });

  it('remove deja el tombstone pendiente hasta que markRemoved lo confirma', () => {
    useWatchlistStore.getState().setItems([{ mediaType: 'movie', mediaId: 8, addedAt: 'x' }]);
    useWatchlistStore.getState().remove('movie', 8);
    expect(useWatchlistStore.getState().pendingRemovals).toEqual(['movie:8']);
    useWatchlistStore.getState().markRemoved('movie', 8);
    expect(useWatchlistStore.getState().pendingRemovals).toHaveLength(0);
  });

  it('reconcileWithServer: snapshot + altas pendientes − bajas pendientes (no muta)', () => {
    // Local: alta offline (movie:9) cuyo upsert falló; tv:1 se empujó y luego
    // se bajó offline (tombstone) sin que el delete llegara al servidor.
    const s0 = useWatchlistStore.getState();
    s0.add('movie', 9);
    s0.add('tv', 1);
    s0.markPushed('tv', 1); // el upsert de tv:1 sí llegó al servidor
    s0.remove('tv', 1);
    // getState() devuelve un SNAPSHOT: las aserciones vuelven a leerlo.
    const pending = useWatchlistStore.getState();
    expect(pending.pendingAdds).toHaveLength(1); // movie:9
    expect(pending.pendingAdds[0].mediaId).toBe(9);
    expect(pending.pendingRemovals).toEqual(['tv:1']);
    // El servidor (leído ANTES de las mutaciones offline) tiene movie:1 y tv:1.
    const reconciled = pending.reconcileWithServer([
      { mediaType: 'movie', mediaId: 1, addedAt: 's1' },
      { mediaType: 'tv', mediaId: 1, addedAt: 's1' },
    ]);
    expect(reconciled).toEqual([
      { mediaType: 'movie', mediaId: 1, addedAt: 's1' }, // del snapshot
      { mediaType: 'movie', mediaId: 9, addedAt: expect.any(String) }, // alta offline reaplicada
      // tv:1 NO: tombstone pendiente
    ]);
  });

  it('reconcileWithServer no duplica si el snapshot ya trae la alta pendiente', () => {
    const store = useWatchlistStore.getState();
    store.add('movie', 4);
    const reconciled = store.reconcileWithServer([
      { mediaType: 'movie', mediaId: 4, addedAt: 'server' },
    ]);
    expect(reconciled).toHaveLength(1);
  });

  it('clearPending vacía la cola pero no la lista (cambio de cuenta)', () => {
    useWatchlistStore.getState().add('movie', 3);
    useWatchlistStore.getState().clearPending();
    const s = useWatchlistStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.pendingAdds).toHaveLength(0);
    expect(s.pendingRemovals).toHaveLength(0);
  });
});
