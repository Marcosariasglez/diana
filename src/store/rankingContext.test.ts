// D2-5 (calidad): getRankingContext. Lee el contexto de ranking (userId,
// taste, seenKeys) de los stores SIN suscribirse: los cambios en history o
// profile deben reflejarse en la siguiente llamada.
jest.mock('@/mocks/mock-ai/taste', () => ({
  buildTasteProfile: jest.fn(() => ({ userId: 'u', weightBp: { 18: 500 } })),
}));

import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { getRankingContext } from './rankingContext';
import { useHistoryStore } from './useHistoryStore';
import { useProfileStore } from './useProfileStore';

const mockBuildTaste = buildTasteProfile as jest.Mock;

describe('getRankingContext (D2-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildTaste.mockImplementation((id: string) => ({ userId: id, weightBp: { 18: 500 } }));
    useProfileStore.setState({
      profile: {
        id: 'user-abc',
        displayName: 'Juan',
        initialRatings: { 5: 'like' },
        favoriteGenres: [],
        favoritePlatforms: ['netflix'],
      },
      hasOnboarded: true,
      hasHydrated: true,
    });
    useHistoryStore.setState({ entries: [], watched: ['tv:9'] });
  });

  it('devuelve userId del perfil, taste del constructor y seenKeys del historial', () => {
    const ctx = getRankingContext();
    expect(ctx.userId).toBe('user-abc');
    expect(ctx.taste).toEqual({ userId: 'user-abc', weightBp: { 18: 500 } });
    // seenKeys: union de entries, watched e initialRatings like/skip.
    expect(ctx.seenKeys.has('tv:9')).toBe(true); // watched
    expect(ctx.seenKeys.has('movie:5')).toBe(true); // initialRating like
    expect(ctx.seenKeys.has('movie:999')).toBe(false);
  });

  it('refleja los cambios de los stores en la llamada siguiente (sin suscripción)', () => {
    getRankingContext();
    useHistoryStore.setState({ entries: [{ key: 'movie:77' } as never], watched: [] });
    useProfileStore.setState((s) => ({
      profile: { ...s.profile, initialRatings: { 5: 'like', 6: 'skip', 8: 'unseen' } },
    }));
    const ctx = getRankingContext();
    expect(ctx.seenKeys.has('movie:77')).toBe(true); // entries
    expect(ctx.seenKeys.has('movie:6')).toBe(true); // skip también cuenta
    expect(ctx.seenKeys.has('movie:8')).toBe(false); // unseen NO cuenta
    // buildTasteProfile llamado con el perfil + entries del momento
    const lastCall = mockBuildTaste.mock.calls[mockBuildTaste.mock.calls.length - 1];
    expect(lastCall[0]).toBe('user-abc');
    expect(lastCall[1]).toEqual({ 5: 'like', 6: 'skip', 8: 'unseen' });
    expect(lastCall[2]).toEqual([{ key: 'movie:77' }]);
  });
});
