// D2-5 (calidad): store de perfil. Mutaciones espejadas al repositorio
// (fallos de red no rompen la UI, B-D9), completeOnboarding deriva géneros
// del gusto y persiste, y createDefaultProfile sigue el wireframe (6.1).
jest.mock('@/services', () => ({
  profileRepository: {
    saveProfile: jest.fn().mockResolvedValue(undefined),
    saveInitialRating: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@/mocks/mock-ai/taste', () => ({
  deriveGenrePreferences: jest.fn(() => [18, 35]),
}));
jest.mock('./useHistoryStore', () => ({
  useHistoryStore: { getState: () => ({ entries: [] }) },
}));

import { DEFAULT_PLATFORMS } from '@/constants/platforms';
import { deriveGenrePreferences } from '@/mocks/mock-ai/taste';
import { profileRepository } from '@/services';
import { useProfileStore } from './useProfileStore';

const mockSaveProfile = profileRepository.saveProfile as jest.Mock;
const mockSaveInitialRating = profileRepository.saveInitialRating as jest.Mock;
const mockDerive = deriveGenrePreferences as jest.Mock;

describe('useProfileStore (D2-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({
      profile: {
        id: 'user-me',
        displayName: 'Juan',
        initialRatings: {},
        favoriteGenres: [],
        favoritePlatforms: [...DEFAULT_PLATFORMS],
      },
      hasOnboarded: false,
      hasHydrated: true,
    });
  });

  it('createDefaultProfile: user-me, Juan, plataformas del wireframe', () => {
    const p = useProfileStore.getState().profile;
    expect(p.id).toBe('user-me');
    expect(p.displayName).toBe('Juan');
    expect(p.favoritePlatforms).toEqual(DEFAULT_PLATFORMS);
    expect(p.initialRatings).toEqual({});
    expect(p.favoriteGenres).toEqual([]);
  });

  it('setDisplayName actualiza y espeja al repositorio', () => {
    useProfileStore.getState().setDisplayName('Marta');
    expect(useProfileStore.getState().profile.displayName).toBe('Marta');
    expect(mockSaveProfile).toHaveBeenCalledWith({ displayName: 'Marta' });
  });

  it('setFavoritePlatforms actualiza (copia del array pasado, no referencia) y espeja', () => {
    const mine = ['netflix'];
    useProfileStore.getState().setFavoritePlatforms(mine);
    mine.push('max'); // mutar el array externo no debe filtrar al store
    expect(useProfileStore.getState().profile.favoritePlatforms).toEqual(['netflix']);
    expect(mockSaveProfile).toHaveBeenCalledWith({ favoritePlatforms: ['netflix'] });
  });

  it('addInitialRating guarda la valoración y espeja con géneros (default [])', () => {
    useProfileStore.getState().addInitialRating(7, 'like', [18]);
    expect(useProfileStore.getState().profile.initialRatings).toEqual({ 7: 'like' });
    expect(mockSaveInitialRating).toHaveBeenCalledWith(7, 'like', [18]);
  });

  it('completeOnboarding marca onboarding, deriva géneros y espeja', () => {
    useProfileStore.getState().addInitialRating(7, 'like');
    useProfileStore.getState().completeOnboarding();
    const s = useProfileStore.getState();
    expect(s.hasOnboarded).toBe(true);
    expect(mockDerive).toHaveBeenCalledWith(
      { 7: 'like' },
      [], // entries del useHistoryStore mockeado
    );
    expect(s.profile.favoriteGenres).toEqual([18, 35]);
    expect(mockSaveProfile).toHaveBeenCalledWith({
      hasOnboarded: true,
      favoriteGenres: [18, 35],
    });
  });

  it('fallo del espejo no rompe la UI: el estado local ya cambió (B-D9)', async () => {
    mockSaveProfile.mockRejectedValueOnce(new Error('offline'));
    useProfileStore.getState().setDisplayName('Ana');
    await Promise.resolve();
    expect(useProfileStore.getState().profile.displayName).toBe('Ana');
  });
});
