// D2-5 (calidad): repositorio Supabase de perfil. load() lee profiles +
// initial_ratings + history_entries + watched con paginación (1000/página) y
// mapea snake_case→camelCase; saveProfile solo parchea los campos pasados;
// saveInitialRating upserta con onConflict PK; removeEntry borra por (user,
// key). Sin sesión → not-authenticated sin tocar la tabla.
const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}));

import { supabaseProfileRepository } from './profile.repository';

interface Builder {
  select: jest.Mock;
  range: jest.Mock;
  order: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>;
}

/** Builder thenable: cada paso devuelve `this` y `await` resuelve `result`. */
function makeTable(result: { data: unknown; error: unknown }): Builder {
  const b = {
    select: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej),
  };
  for (const k of ['select', 'range', 'order', 'eq', 'single', 'update', 'upsert', 'delete'] as const) {
    b[k].mockReturnValue(b);
  }
  return b;
}

const USER_ID = 'u-1';
const PROFILE_ROW = {
  id: USER_ID,
  display_name: 'Marta',
  favorite_platforms: ['netflix'],
  favorite_genres: [18],
  has_onboarded: true,
};

function historyRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: USER_ID,
    key: 'movie:1',
    media_type: 'movie',
    media_id: 1,
    season: null,
    episode: null,
    title: 'Peli',
    genre_ids: [18],
    user_rating: 4,
    ai_prediction_tenths: 35,
    prediction_seen: true,
    source: 'app',
    rated_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('supabaseProfileRepository (D2-5)', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it('load mapea perfil + ratings + historial + vistos', async () => {
    const p = makeTable({ data: PROFILE_ROW, error: null });
    const r = makeTable({
      data: [
        { media_id: 1, value: 'like', genre_ids: [18] },
        { media_id: 2, value: 'skip', genre_ids: [] },
      ],
      error: null,
    });
    const h = makeTable({ data: [historyRow()], error: null });
    const w = makeTable({ data: [{ key: 'tv:9' }], error: null });
    // Orden de llamadas: profiles, initial_ratings, history_entries, watched.
    mockFrom.mockReturnValueOnce(p).mockReturnValueOnce(r).mockReturnValueOnce(h).mockReturnValueOnce(w);

    const loaded = await supabaseProfileRepository.load();
    // El repo Supabase SIEMPRE devuelve datos (null es solo del repo mock).
    const data = loaded as NonNullable<typeof loaded>;
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'profiles');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'initial_ratings');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'history_entries');
    expect(mockFrom).toHaveBeenNthCalledWith(4, 'watched');
    expect(p.single).toHaveBeenCalled();
    expect(h.order).toHaveBeenCalledWith('rated_at', { ascending: false });

    expect(data.profile).toEqual({
      displayName: 'Marta',
      favoritePlatforms: ['netflix'],
      favoriteGenres: [18],
      hasOnboarded: true,
    });
    expect(data.initialRatings).toEqual({ 1: 'like', 2: 'skip' });
    expect(data.initialGenres).toEqual({ 1: [18], 2: [] });
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].key).toBe('movie:1');
    expect(data.entries[0].aiPrediction).toBe(3.5);
    expect(data.watched).toEqual(['tv:9']);
  });

  it('load sin sesión lanza not-authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(supabaseProfileRepository.load()).rejects.toThrow('not-authenticated');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('saveProfile parchea SOLO los campos pasados (snake_case) y con el user de la sesión', async () => {
    const p = makeTable({ data: null, error: null });
    mockFrom.mockReturnValue(p);
    await supabaseProfileRepository.saveProfile({ displayName: 'Ana' });
    expect(p.update).toHaveBeenCalledWith({ display_name: 'Ana' });
    expect(p.eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('saveInitialRating upserta con onConflict en la PK (user_id, media_id)', async () => {
    const t = makeTable({ data: null, error: null });
    mockFrom.mockReturnValue(t);
    await supabaseProfileRepository.saveInitialRating(7, 'like', [18]);
    expect(t.upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, media_id: 7, value: 'like', genre_ids: [18] },
      { onConflict: 'user_id,media_id' },
    );
  });

  it('removeEntry borra por (user_id, key)', async () => {
    const t = makeTable({ data: null, error: null });
    mockFrom.mockReturnValue(t);
    await supabaseProfileRepository.removeEntry('movie:1');
    expect(t.delete).toHaveBeenCalled();
    expect(t.eq).toHaveBeenNthCalledWith(1, 'user_id', USER_ID);
    expect(t.eq).toHaveBeenNthCalledWith(2, 'key', 'movie:1');
  });

  it('error de PostgREST en load se propaga (lo captura bootstrapUserData)', async () => {
    mockFrom.mockReturnValue(makeTable({ data: null, error: { message: 'boom' } }));
    await expect(supabaseProfileRepository.load()).rejects.toMatchObject({ message: 'boom' });
  });
});
