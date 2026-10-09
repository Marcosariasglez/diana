import { useProfileStore } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';

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
    upsert: jest.fn(),
    remove: jest.fn(),
  },
}));

import { bootstrapUserData } from './bootstrapUserData';
import { profileRepository } from '@/services';

const mockLoad = profileRepository.load as jest.Mock;

afterEach(() => {
  mockLoad.mockReset();
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
});
