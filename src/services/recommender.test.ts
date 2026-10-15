import type { TVSeries } from '@/types/media';

// D2-2 / F4-3: recomendador real — interruptor `activeRecommender()` y el mapeo
// de las respuestas de los RPC `recommend` / `predict_tenths` (migración 0007).
//
// `recommender.ts` lee `RECOMMENDER` de env.ts al cargar. Se mockea el módulo
// para controlar el modo del recomendador.
const envState: { RECOMMENDER: string } = { RECOMMENDER: 'content' };
const sbState: { client: unknown } = { client: null };

jest.mock('@/lib/env', () => envState);
jest.mock('@/lib/supabase', () => ({ getSupabase: () => sbState.client }));

function loadRecommender() {
  jest.resetModules();
  return require('@/services/recommender');
}

describe('recommender: activeRecommender (D2-2.6 / F4-3)', () => {
  beforeEach(() => {
    envState.RECOMMENDER = 'content';
    sbState.client = null;
  });

  it('heuristic cuando RECOMMENDER=heuristic', () => {
    envState.RECOMMENDER = 'heuristic';
    expect(loadRecommender().activeRecommender()).toBe('heuristic');
  });

  it('content cuando RECOMMENDER=content', () => {
    expect(loadRecommender().activeRecommender()).toBe('content');
  });
});

describe('recommender: contentRecommend (RPC recommend)', () => {
  beforeEach(() => {
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

  // F2-1: una fila del RPC con tmdb_id que EXISTE en el catálogo mock (52 →
  // 'Breaking Bad' en el mock, serie) y un título real distinto debe devolver
  // SIEMPRE el título de la fila, nunca datos del MOCK_CATALOG.
  it('F2-1: fila RPC con tmdb_id=52 NO devuelve el título del MOCK_CATALOG', async () => {
    const rpc = jest.fn().mockResolvedValue({
      error: null,
      data: [{ media_type: 'tv', tmdb_id: 52, title: 'The Bear', poster_path: null, score: 0.4, explanation: [] }],
    });
    sbState.client = { rpc };
    const mod = loadRecommender();
    const recs = await mod.contentRecommend({ platforms: ['netflix'] });
    expect(recs).toHaveLength(1);
    const media = recs?.[0]?.media;
    expect(media).toBeDefined();
    expect(media?.media_type).toBe('tv');
    expect(media?.id).toBe(52);
    // El título es el de la fila del RPC, no el del mock ('Breaking Bad').
    const tv = media as TVSeries | undefined;
    expect(tv?.name).toBe('The Bear');
    expect(tv?.name).not.toBe('Breaking Bad');
    // NUNCA se complementa con datos mock: géneros/plataformas vacíos, sin
    // overview ni vote_average del mock (8.9, 14500).
    expect(media?.genres).toEqual([]);
    expect(media?.platforms).toEqual([]);
    expect(media?.vote_average).toBe(0);
    expect(media?.overview).toBe('');
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
