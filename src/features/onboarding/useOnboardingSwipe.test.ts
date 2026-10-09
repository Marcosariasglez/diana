// D2-2.5 (VERTICE-PLAN-2): el swipe de onboarding pasa las plataformas del
// perfil al mazo («populares en tus plataformas» con 0 valoraciones) y lo
// expone como `popularOnPlatforms` para el rótulo de la pantalla.
import { act, renderHook } from '@testing-library/react-native';
import type { Movie } from '@/types/media';

jest.mock('@/services', () => ({
  catalogRepository: { getOnboardingDeck: jest.fn() },
}));
// El store de zustand expone `getState` como propiedad de la función hook; el
// mock replica esa forma para que `useProfileStore.getState()` funcione.
jest.mock('@/store/useProfileStore', () => {
  const hook = jest.fn() as jest.Mock & { getState: jest.Mock };
  hook.getState = jest.fn();
  return { useProfileStore: hook };
});

import { ONBOARDING_COUNT } from '@/constants/onboarding';
import { catalogRepository } from '@/services';
import { useProfileStore } from '@/store/useProfileStore';
import { useOnboardingSwipe } from './useOnboardingSwipe';

const getDeck = catalogRepository.getOnboardingDeck as jest.Mock;
const storeHook = useProfileStore as unknown as { getState: jest.Mock } & jest.Mock;

let platforms: string[] = [];

function movie(id: number): Movie {
  return {
    id,
    media_type: 'movie',
    title: `Peli ${id}`,
    release_date: '2022-01-01',
    runtime: 100,
    poster_path: null,
    backdrop_path: null,
    genres: [{ id: 18, name: 'Drama' }],
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: ['netflix'],
    alt_titles: [],
  };
}

describe('useOnboardingSwipe con plataformas (D2-2.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platforms = ['netflix', 'prime-video', 'max', 'disney-plus'];
    storeHook.mockImplementation((sel: (s: unknown) => unknown) =>
      sel({ addInitialRating: jest.fn(), completeOnboarding: jest.fn() }),
    );
    storeHook.getState.mockReturnValue({ profile: { favoritePlatforms: platforms } });
    getDeck.mockResolvedValue([movie(1), movie(2)]);
  });

  it('pide el mazo con las plataformas del perfil (0 valoraciones)', async () => {
    await renderHook(() => useOnboardingSwipe());
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDeck).toHaveBeenCalledWith(ONBOARDING_COUNT, platforms);
  });

  it('expone popularOnPlatforms=true cuando el perfil tiene plataformas', async () => {
    const { result } = await renderHook(() => useOnboardingSwipe());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.popularOnPlatforms).toBe(true);
    expect(result.current.cards).toHaveLength(2);
  });

  it('popularOnPlatforms=false cuando el perfil no tiene plataformas', async () => {
    platforms = [];
    storeHook.getState.mockReturnValue({ profile: { favoritePlatforms: platforms } });
    const { result } = await renderHook(() => useOnboardingSwipe());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.popularOnPlatforms).toBe(false);
    expect(getDeck).toHaveBeenCalledWith(ONBOARDING_COUNT, []);
  });

  it('si el mazo llega vacio el estado queda en error', async () => {
    getDeck.mockResolvedValue([]);
    const { result } = await renderHook(() => useOnboardingSwipe());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.popularOnPlatforms).toBe(false);
  });
});
