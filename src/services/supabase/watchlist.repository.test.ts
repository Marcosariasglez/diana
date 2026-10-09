// D2-3: repositorio Supabase de la watchlist (tabla `watchlist`, migración
// 0008). Se comprueba el mapeo fila→item, el upsert con onConflict
// (user_id,media_type,media_id) conservando el added_at del cliente, el
// borrado por (user, tipo, id) y el fallo sin sesión.
//
// El mock de `from` devuelve un builder thenable: cada paso de cadena
// (select/range/order/eq/upsert/delete) devuelve el mismo builder y `await`
// resuelve con el resultado { data, error } (como el builder real de
// supabase-js; el error de PostgREST es un objeto plano, no una Error).
const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}));

import { supabaseWatchlistRepository } from './watchlist.repository';

interface QueryBuilder {
  select: jest.Mock;
  range: jest.Mock;
  order: jest.Mock;
  eq: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown>;
}

function makeQuery(result: { data: unknown; error: unknown }): QueryBuilder {
  const b = {
    select: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    eq: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej),
  };
  b.select.mockReturnValue(b);
  b.range.mockReturnValue(b);
  b.order.mockReturnValue(b);
  b.eq.mockReturnValue(b);
  b.upsert.mockReturnValue(b);
  b.delete.mockReturnValue(b);
  return b;
}

const USER = { id: 'u-1' };

describe('supabaseWatchlistRepository (D2-3)', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
  });

  it('load mapea las filas (snake_case → camelCase)', async () => {
    const q = makeQuery({
      data: [
        { media_type: 'movie', media_id: 7, added_at: '2026-01-02T00:00:00.000Z' },
        { media_type: 'tv', media_id: 3, added_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(q);
    const items = await supabaseWatchlistRepository.load();
    expect(items).toEqual([
      { mediaType: 'movie', mediaId: 7, addedAt: '2026-01-02T00:00:00.000Z' },
      { mediaType: 'tv', mediaId: 3, addedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(q.order).toHaveBeenCalledWith('added_at', { ascending: false });
  });

  it('load con tabla ausente (0008 sin desplegar) lanza el error (lo captura bootstrap)', async () => {
    const msg = 'relation "public.watchlist" does not exist';
    mockFrom.mockReturnValue(makeQuery({ data: null, error: { message: msg } }));
    // El repo lanza el error plano de PostgREST; bootstrap lo captura y
    // conserva la copia local.
    await expect(supabaseWatchlistRepository.load()).rejects.toMatchObject({ message: msg });
  });

  it('upsert escribe con el user de la sesión y onConflict en la PK (conserva added_at local)', async () => {
    const q = makeQuery({ data: null, error: null });
    mockFrom.mockReturnValue(q);
    await supabaseWatchlistRepository.upsert({
      mediaType: 'movie',
      mediaId: 7,
      addedAt: '2026-02-01T10:00:00.000Z',
    });
    expect(mockFrom).toHaveBeenCalledWith('watchlist');
    expect(q.upsert).toHaveBeenCalledWith(
      {
        user_id: USER.id,
        media_type: 'movie',
        media_id: 7,
        added_at: '2026-02-01T10:00:00.000Z',
      },
      { onConflict: 'user_id,media_type,media_id' },
    );
  });

  it('upsert sin sesión lanza not-authenticated (no toca la tabla)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(
      supabaseWatchlistRepository.upsert({ mediaType: 'movie', mediaId: 1, addedAt: 'x' }),
    ).rejects.toThrow('not-authenticated');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('remove borra por (user_id, media_type, media_id)', async () => {
    const q = makeQuery({ data: null, error: null });
    mockFrom.mockReturnValue(q);
    await supabaseWatchlistRepository.remove('tv', 3);
    expect(mockFrom).toHaveBeenCalledWith('watchlist');
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenNthCalledWith(1, 'user_id', USER.id);
    expect(q.eq).toHaveBeenNthCalledWith(2, 'media_type', 'tv');
    expect(q.eq).toHaveBeenNthCalledWith(3, 'media_id', 3);
  });

  it('remove sin sesión lanza not-authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(supabaseWatchlistRepository.remove('movie', 1)).rejects.toThrow('not-authenticated');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
