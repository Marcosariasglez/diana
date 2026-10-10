// D2-2: recomendador real — interruptor `activeRecommender()` y el mapeo de las
// respuestas de los RPC `recommend` / `predict_tenths` (migración 0007).
//
// `recommender.ts` deconstruye `CATALOG`/`RECOMMENDER` al cargar, así que cada
// prueba fija los valores del mock y vuelve a cargar el módulo (resetModules)
// para que capture los nuevos.
const envState: { CATALOG: string; RECOMMENDER: string } = { CATALOG: 'tmdb', RECOMMENDER: 'content' };
const sbState: { client: unknown } = { client: null };

jest.mock('@/lib/env', () => envState);
jest.mock('@/lib/supabase', () => ({ getSupabase: () => sbState.client }));

function loadRecommender() {
  jest.resetModules();
  return require('@/services/recommender');
}

describe('recommender: activeRecommender (D2-2.6)', () => {
  beforeEach(() => {
    envState.CATALOG = 'tmdb';
    envState.RECOMMENDER = 'content';
    sbState.client = null;
  });

  it('heuristic cuando RECOMMENDER=heuristic (defecto)', () => {
    envState.RECOMMENDER = 'heuristic';
    expect(loadRecommender().activeRecommender()).toBe('heuristic');
  });

  it('heuristic cuando CATALOG=mock aunque RECOMMENDER=content', () => {
    envState.CATALOG = 'mock';
    expect(loadRecommender().activeRecommender()).toBe('heuristic');
  });

  it('content cuando RECOMMENDER=content y CATALOG=tmdb', () => {
    expect(loadRecommender().activeRecommender()).toBe('content');
  });
});

describe('recommender: contentRecommend (RPC recommend)', () => {
  beforeEach(() => {
    envState.CATALOG = 'tmdb';
    envState.RECOMMENDER = 'content';
  });

  it('mapea filas del RPC a ContentRecommendation[] (score numérico y explicación)', async () => {
    const rpc = jest.fn().mockResolvedValue({
      error: null,
      data: [
        { media_type: 'movie', tmdb_id: 9001, title: 'A', poster_path: null, score: 0.5, explanation: ['Porque te gustó X'] },
        { media_type: 'tv', tmdb_id: 9002, title: 'B', poster_path: null, score: '0.1', explanation: [] },
      ],
    });
    sbState.client = { rpc };
    const mod = loadRecommender();
    const recs = await mod.contentRecommend({ platforms: ['netflix'] });
    expect(rpc).toHaveBeenCalledWith(
      'recommend',
      expect.objectContaining({ p_platforms: ['netflix'], p_limit: 50, p_offset: 0 }),
    );
    expect(recs).toHaveLength(2);
    expect(recs?.[0]?.score).toBe(0.5);
    expect(recs?.[0]?.explanation).toEqual(['Porque te gustó X']);
    expect(recs?.[1]?.score).toBe(0.1); // string del RPC → number
    expect(recs?.[1]?.media.media_type).toBe('tv');
  });

  it('filas con tmdb_id del catálogo mock devuelven el Media completo (modo desarrollo)', async () => {
    const rpc = jest.fn().mockResolvedValue({
      error: null,
      data: [{ media_type: 'movie', tmdb_id: 1, title: 'Ignorado', poster_path: null, score: 0.2, explanation: [] }],
    });
    sbState.client = { rpc };
    const mod = loadRecommender();
    const recs = await mod.contentRecommend({ platforms: ['netflix'] });
    // id 1 existe en el mock catalog → se devuelve ese Media (no el título del RPC)
    expect(recs?.[0]?.media.id).toBe(1);
  });

  it('devuelve null si el RPC falla (para que el caller decaiga a heuristic)', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: { message: 'rpc-no-existe' }, data: null });
    sbState.client = { rpc };
    expect(await loadRecommender().contentRecommend({ platforms: ['netflix'] })).toBeNull();
  });

  it('devuelve null si el cliente Supabase lanza (sin sesión / no configurado)', async () => {
    sbState.client = { rpc: jest.fn().mockRejectedValue(new Error('boom')) };
    expect(await loadRecommender().contentRecommend({ platforms: ['netflix'] })).toBeNull();
  });
});

describe('recommender: contentPredictTenths (RPC predict_tenths)', () => {
  beforeEach(() => {
    envState.CATALOG = 'tmdb';
    envState.RECOMMENDER = 'content';
  });

  it('devuelve la décima dentro de rango', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null, data: 42 });
    sbState.client = { rpc };
    const mod = loadRecommender();
    expect(await mod.contentPredictTenths('movie', 9001)).toBe(42);
    expect(rpc).toHaveBeenCalledWith('predict_tenths', { p_media_type: 'movie', p_tmdb_id: 9001 });
  });

  it('devuelve null si la décima está fuera de 10..50', async () => {
    sbState.client = { rpc: jest.fn().mockResolvedValue({ error: null, data: 99 }) };
    expect(await loadRecommender().contentPredictTenths('movie', 9001)).toBeNull();
  });

  it('devuelve null si el RPC falla', async () => {
    sbState.client = { rpc: jest.fn().mockResolvedValue({ error: { message: 'x' }, data: null }) };
    expect(await loadRecommender().contentPredictTenths('movie', 9001)).toBeNull();
  });
});
