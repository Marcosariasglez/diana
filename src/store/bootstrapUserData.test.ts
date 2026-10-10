import { useProfileStore } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';
import { useWatchlistStore } from './useWatchlistStore';

// El bootstrap solo necesita load() de profileRepository: se mockea el módulo
// de servicios (las demás exports se sustituyen por no-ops).
jest.mock('@/services', () => ({
  profileRepository: {
    load: jest.fn(),
    saveProfile: jest.fn(),
    saveInitialRating: jest.fn(),
    saveImport: jest.fn(),
    removeEntry: jest.fn(),
  },
  watchlistRepository: {
    load: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/lib/syncError', () => ({ reportSyncError: jest.fn() }));

import { bootstrapUserData } from './bootstrapUserData';
import { profileRepository, watchlistRepository } from '@/services';

const mockLoad = profileRepository.load as jest.Mock;
const mockWlUpsert = watchlistRepository.upsert as jest.Mock;
const mockWlRemove = watchlistRepository.remove as jest.Mock;

const REMOTE = {
  profile: { displayName: 'Marta', favoritePlatforms: ['max'], favoriteGenres: [18], hasOnboarded: true },
  initialRatings: { 7: 'like' },
  initialGenres: { 7: [53] },
  entries: [],
  watched: ['movie:2'],
};

afterEach(() => {
  mockLoad.mockReset();
  mockWlUpsert.mockClear();
  mockWlRemove.mockClear();
  useWatchlistStore.getState().setItems([]);
  useWatchlistStore.getState().clearPending();
});

describe('bootstrapUserData (VERTICE plan2 D2-0)', () => {
  it('un perfil remoto completo se aplica tal cual', async () => {
    mockLoad.mockResolvedValueOnce({
      profile: { displayName: 'Marta', favoritePlatforms: ['max'], favoriteGenres: [18], hasOnboarded: true },
      initialRatings: { 7: 'like' },
      initialGenres: { 7: [53] },
      entries: [],
      watched: ['movie:2'],
    });
    await bootstrapUserData('user-2');
    const s = useProfileStore.getState();
    expect(s.profile.id).toBe('user-2');
    expect(s.profile.displayName).toBe('Marta');
    expect(s.profile.favoritePlatforms).toEqual(['max']);
    expect(s.profile.favoriteGenres).toEqual([18]);
    expect(s.hasOnboarded).toBe(true);
    expect(useHistoryStore.getState().watched).toEqual(['movie:2']);
  });

  it('un perfil parcial (columnas NULL/ausentes) NO deja undefined en el store', async () => {
    // Lo que pasa si el .single() devuelve filas con columnas nulas o si el
    // cliente recibe una respuesta incompleta: sin la normalización, los
    // campos undefined se desechan al persistir (JSON) y en el siguiente
    // arranque useFeedData hace platforms.length sobre undefined → pantalla
    // en blanco de toda la app (D2-0: repro E2E del 2026-10-09).
    mockLoad.mockResolvedValueOnce({
      profile: {
        displayName: undefined,
        favoritePlatforms: undefined,
        favoriteGenres: undefined,
        hasOnboarded: undefined,
      },
      initialRatings: { 7: 'like' },
      initialGenres: {},
      entries: [],
      watched: [],
    });
    await bootstrapUserData('user-3');
    const s = useProfileStore.getState();
    expect(s.profile.id).toBe('user-3');
    // El tipo dice string[]/number[]/string/boolean: nunca undefined.
    expect(s.profile.displayName).toBe('');
    expect(Array.isArray(s.profile.favoritePlatforms)).toBe(true);
    expect(s.profile.favoritePlatforms.length).toBeGreaterThan(0); // no se queda con 0
    expect(s.profile.favoritePlatforms).toContain('netflix'); // default de Diana
    expect(s.profile.favoriteGenres).toEqual([]);
    expect(s.hasOnboarded).toBe(false);
    // Invariante clave: lo que persiste nunca contiene undefined
    // (si lo hiciera, el siguiente arranco leería un perfil roto).
    for (const [k, v] of Object.entries(s.profile)) {
      if (v === undefined) throw new Error(`profile.${k} no puede ser undefined`);
    }
  });

  it('mutaciones offline pendientes se reconcilian con el snapshot del servidor', async () => {
    mockLoad.mockResolvedValueOnce(REMOTE);
    (watchlistRepository.load as jest.Mock).mockResolvedValueOnce([
      { mediaType: 'movie', mediaId: 1, addedAt: 's1' },
    ]);
    // El usuario local YA es user-2 (no se resetea: la cola sobrevive) y hay
    // mutaciones offline pendientes: alta de movie:9 cuyo upsert falló y baja
    // de movie:1 cuyo delete falló (tombstone) — el servidor sigue teniéndolo.
    useProfileStore.setState({
      profile: { ...useProfileStore.getState().profile, id: 'user-2' },
      hasOnboarded: false,
    });
    useWatchlistStore.getState().add('movie', 9);
    useWatchlistStore.getState().add('movie', 1);
    useWatchlistStore.getState().markPushed('movie', 1);
    useWatchlistStore.getState().remove('movie', 1);
    expect(useWatchlistStore.getState().pendingRemovals).toEqual(['movie:1']);

    await bootstrapUserData('user-2');
    // El reintento del empuje es fire-and-forget: se drenan las microtareas
    // (upsert → markPushed → remove → markRemoved) antes de inspeccionar.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // El snapshot se aplica RECONCILIADO: movie:9 reaparece (alta offline) y
    // movie:1 se re-borra (tombstone). Después se reintenta el empuje.
    const keys = useWatchlistStore.getState().items.map((i) => `${i.mediaType}:${i.mediaId}`).sort();
    expect(keys).toEqual(['movie:9']);
    expect(mockWlUpsert).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'movie', mediaId: 9 }));
    expect(mockWlRemove).toHaveBeenCalledWith('movie', 1);
    // Con el empuje logrado, la cola queda vacía.
    expect(useWatchlistStore.getState().pendingAdds).toHaveLength(0);
    expect(useWatchlistStore.getState().pendingRemovals).toHaveLength(0);
  });
});
