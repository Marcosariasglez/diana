import { buildExportPayload, buildLocalExportPayload, exportFileName } from './export';

const mockFrom = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: mockFrom,
    auth: { getSession: () => mockGetSession() },
  }),
}));

jest.mock('@/store/useProfileStore', () => ({
  useProfileStore: {
    getState: () => ({
      profile: {
        id: 'user-a',
        displayName: 'Ana',
        favoritePlatforms: ['netflix'],
        favoriteGenres: [1],
        initialRatings: {},
      },
      hasOnboarded: true,
    }),
  },
}));

jest.mock('@/store/useHistoryStore', () => ({
  useHistoryStore: {
    getState: () => ({
      entries: [
        {
          key: 'movie:1',
          ref: { mediaType: 'movie', mediaId: 1 },
          title: 'Aftersun',
          posterColor: '#333333',
          userRating: 4,
          aiPrediction: 3.8,
          predictionSeen: true,
          ratedAt: '2026-10-01T10:00:00.000Z',
          source: 'app',
        },
      ],
      watched: ['movie:1'],
    }),
  },
}));

function tableMock(data: unknown[]) {
  // Como supabase-js: los builders son awaitables (thenable) y encadenables.
  return {
    select: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
    single: jest.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
    then: (res: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data, error: null }).then(res),
  };
}

const ROWS: Record<string, unknown[]> = {
  profiles: [{ id: 'user-a', display_name: 'Ana', favorite_platforms: ['netflix'], favorite_genres: [1], has_onboarded: true }],
  initial_ratings: [{ media_id: 7, value: 'like', genre_ids: [2] }],
  history_entries: [
    {
      user_id: 'user-a', key: 'movie:1', media_type: 'movie', media_id: 1, season: null, episode: null,
      title: 'Aftersun', genre_ids: [1], user_rating: 4, ai_prediction_tenths: 38,
      prediction_seen: true, source: 'app', rated_at: '2026-10-01T10:00:00.000Z',
    },
  ],
  watched: [{ key: 'movie:1' }],
  rooms: [{ code: 'ABCD', host_id: 'user-a' }],
  room_members: [{ code: 'ABCD' }],
  watchlist: [{ media_type: 'movie', media_id: 9, added_at: '2026-10-02T10:00:00.000Z' }],
};

describe('export (A5 · Exportar mis datos)', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation((t: string) => tableMock(ROWS[t] ?? []));
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-a', email: 'ana@vertice.app' } } } });
  });

  it('nombre de fichero: diana-mis-datos-AAAA-MM-DD.json', () => {
    expect(exportFileName(new Date(2026, 9, 8))).toBe('diana-mis-datos-2026-10-08.json');
  });

  it('buildExportPayload: formato A5 con los datos del usuario', async () => {
    const payload = await buildExportPayload();
    expect(payload.app).toBe('diana');
    expect(payload.user).toEqual({ id: 'user-a', email: 'ana@vertice.app' });
    expect(payload.profile.displayName).toBe('Ana');
    expect(payload.initialRatings).toEqual([{ mediaId: 7, value: 'like', genreIds: [2] }]);
    expect(payload.historyEntries).toEqual([
      {
        key: 'movie:1', mediaType: 'movie', mediaId: 1, season: null, episode: null,
        title: 'Aftersun', userRating: 4, source: 'app', ratedAt: '2026-10-01T10:00:00.000Z',
      },
    ]);
    expect(payload.watched).toEqual(['movie:1']);
    expect(payload.rooms).toEqual([{ code: 'ABCD', isHost: true }]);
    // D2-3: la watchlist va en el export.
    expect(payload.watchlist).toEqual([
      { mediaType: 'movie', mediaId: 9, addedAt: '2026-10-02T10:00:00.000Z' },
    ]);
    expect(new Date(payload.exportedAt).toISOString()).toBe(payload.exportedAt);
  });

  it('solo incluye las salas que le pertenecen', async () => {
    ROWS.rooms = [
      { code: 'ABCD', host_id: 'user-a' },
      { code: 'WXYZ', host_id: 'otro-usuario' },
    ];
    const payload = await buildExportPayload();
    expect(payload.rooms.map((r) => r.code)).toEqual(['ABCD']);
  });

  it('buildLocalExportPayload: solo datos locales (sin datos de otros usuarios)', () => {
    const payload = buildLocalExportPayload();
    expect(payload.app).toBe('diana');
    expect(payload.user.id).toBe('user-a');
    expect(payload.historyEntries).toHaveLength(1);
    expect(payload.historyEntries[0].mediaId).toBe(1);
    expect(JSON.stringify(payload)).not.toContain('otro-usuario');
  });

  it('si el servidor falla, buildLocalExportPayload sigue devolviendo solo lo local', async () => {
    const payload = buildLocalExportPayload();
    expect(payload.app).toBe('diana');
    expect(payload.historyEntries.every((e) => e.key.startsWith('movie:'))).toBe(true);
    expect(payload.rooms).toEqual([]);
  });
});
