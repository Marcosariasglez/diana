/// <reference types="jest" />
/**
 * C1: Test del reintento sin logged_at (defensa PGRST204).
 *
 * Verifica que si el upsert falla por columna logged_at inexistente
 * (migración 0023 pendiente), el repositorio reintenta una vez sin
 * logged_at para no romper la app en vuelo.
 *
 * F2-2: la predicción de la ficha usa el RPC `predict_tenths`
 * (`contentPredictTenths`) cuando `activeRecommender() === 'content'`;
 * si devuelve null o falla, cae a la heurística `predictTenths`.
 */

import type { Rating } from '@/types/rating';

/** Estado del recomendador mockeado (controlable por test). */
const recState: { kind: 'heuristic' | 'content'; tenths: number | null } = {
  kind: 'heuristic',
  tenths: null,
};
jest.mock('../recommender', () => ({
  activeRecommender: () => recState.kind,
  contentPredictTenths: jest.fn(async () => recState.tenths),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('@/services/catalog.select', () => ({
  activeCatalogRepository: {
    getMediaById: jest.fn(),
  },
}));
jest.mock('@/store/useHistoryStore', () => ({
  useHistoryStore: {
    getState: () => ({ entries: [] }),
  },
}));
jest.mock('@/store/useProfileStore', () => ({
  useProfileStore: {
    getState: () => ({ profile: { id: 'test', initialRatings: [], affinity: {} } }),
  },
}));
jest.mock('@/recommender/predict', () => ({ predictTenths: jest.fn(() => 65) }));
jest.mock('@/recommender/taste', () => ({ buildTasteProfile: () => ({ genreBoosts: new Map() }) }));
jest.mock('@/utils/media', () => ({ titleOf: () => 'Test Movie' }));
jest.mock('@/utils/mediaKey', () => ({ buildMediaKey: () => 'movie:42' }));

const { getSupabase } = require('@/lib/supabase');
const { activeCatalogRepository } = require('@/services/catalog.select');

function makeClient(options: {
  upsertErrorFirst?: Error | null;
  upsertErrorSecond?: Error | null;
  existingEntry?: Record<string, unknown> | null;
}) {
  let upsertCallCount = 0;
  const upsertCalls: unknown[] = [];

  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    rpc: jest.fn().mockResolvedValue({ error: null, data: recState.tenths }),
    from(_table: string) {
      const b = {
        eq(_col: string, _val: unknown) {
          return b;
        },
        maybeSingle() {
          return Promise.resolve({ data: options.existingEntry ?? null, error: null });
        },
      };
      return {
        select(_cols: string) {
          return b;
        },
        upsert(row: unknown, _opts: unknown) {
          upsertCallCount++;
          upsertCalls.push(row);
          const err = upsertCallCount === 1 ? options.upsertErrorFirst : options.upsertErrorSecond;
          return Promise.resolve({ data: null, error: err });
        },
      };
    },
  };

  return { client, getUpsertCalls: () => upsertCalls, getUpsertCallCount: () => upsertCallCount };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: recomendador en modo 'heuristic' (como en el resto de tests)
  // y sin valor del RPC.
  recState.kind = 'heuristic';
  recState.tenths = null;
  activeCatalogRepository.getMediaById.mockResolvedValue({
    id: 42,
    media_type: 'movie',
    title: 'Test Movie',
    genres: [{ id: 28, name: 'Acción' }],
  });
});

describe('supabaseRatingRepository', () => {
  const rating: Rating = 8 as Rating;

  it('reintenta sin logged_at al recibir PGRST204', async () => {
    const { client, getUpsertCalls, getUpsertCallCount } = makeClient({
      upsertErrorFirst: Object.assign(new Error('column logged_at does not exist'), { code: 'PGRST204' }),
      upsertErrorSecond: null,
    });
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    await supabaseRatingRepository.saveRating({
      mediaRef: { mediaType: 'movie', mediaId: 42 },
      userRating: rating,
      origin: 'daily-log',
    });

    expect(getUpsertCallCount()).toBe(2);
    const [first, second] = getUpsertCalls();
    expect(first).toHaveProperty('logged_at');
    expect(second).not.toHaveProperty('logged_at');
  });

  it('reintenta sin logged_at al recibir error con "logged_at" en mensaje', async () => {
    const { client, getUpsertCallCount } = makeClient({
      upsertErrorFirst: new Error('relation error: logged_at'),
      upsertErrorSecond: null,
    });
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    await supabaseRatingRepository.saveRating({
      mediaRef: { mediaType: 'movie', mediaId: 42 },
      userRating: rating,
      origin: 'daily-log',
    });

    expect(getUpsertCallCount()).toBe(2);
  });

  it('no reintenta si el primer upsert exita', async () => {
    const { client, getUpsertCallCount } = makeClient({
      upsertErrorFirst: null,
    });
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    await supabaseRatingRepository.saveRating({
      mediaRef: { mediaType: 'movie', mediaId: 42 },
      userRating: rating,
      origin: 'daily-log',
    });

    expect(getUpsertCallCount()).toBe(1);
  });

  it('propaga error si reintento también falla', async () => {
    const { client } = makeClient({
      upsertErrorFirst: Object.assign(new Error('column logged_at does not exist'), { code: 'PGRST204' }),
      upsertErrorSecond: new Error('other error'),
    });
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    await expect(
      supabaseRatingRepository.saveRating({
        mediaRef: { mediaType: 'movie', mediaId: 42 },
        userRating: rating,
        origin: 'daily-log',
      }),
    ).rejects.toThrow('other error');
  });

  // --- F2-2: la predicción de la ficha usa el RPC `predict_tenths` ---------

  it('F2-2a: activeRecommender=content y el RPC devuelve 34 → ai_prediction_tenths === 34', async () => {
    recState.kind = 'content';
    recState.tenths = 34;
    const { client, getUpsertCalls } = makeClient({});
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    const { contentPredictTenths } = require('../recommender');
    await supabaseRatingRepository.saveRating({
      mediaRef: { mediaType: 'movie', mediaId: 42 },
      userRating: rating,
      origin: 'detail',
    });

    // El RPC se llama con la referencia del media…
    expect(contentPredictTenths).toHaveBeenCalledWith('movie', 42);
    // …y su valor (no el 65 de la heurística mockeada) es el que se guarda.
    const [row] = getUpsertCalls() as Array<Record<string, unknown>>;
    expect(row.ai_prediction_tenths).toBe(34);
  });

  it('F2-2b: activeRecommender=content y el RPC devuelve null/errores → heurística local', async () => {
    recState.kind = 'content';
    recState.tenths = null; // contentPredictTenths resuelve null cuando el RPC falla o devuelve null
    const { client, getUpsertCalls } = makeClient({});
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    const { predictTenths } = require('@/recommender/predict');
    await supabaseRatingRepository.saveRating({
      mediaRef: { mediaType: 'movie', mediaId: 42 },
      userRating: rating,
      origin: 'detail',
    });

    // Se usó la red de seguridad (predictTenths → 65 en el mock).
    expect(predictTenths).toHaveBeenCalled();
    const [row] = getUpsertCalls() as Array<Record<string, unknown>>;
    expect(row.ai_prediction_tenths).toBe(65);
  });

  it('F2-2c: entrada existente → no se vuelve a calcular (se conserva el valor guardado)', async () => {
    recState.kind = 'content';
    recState.tenths = 34;
    const { client, getUpsertCalls } = makeClient({
      existingEntry: { ai_prediction_tenths: 21, prediction_seen: false, source: 'app' },
    });
    getSupabase.mockReturnValue(client);

    const { supabaseRatingRepository } = require('./rating.repository');
    const { contentPredictTenths } = require('../recommender');
    await supabaseRatingRepository.saveRating({
      mediaRef: { mediaType: 'movie', mediaId: 42 },
      userRating: rating,
      origin: 'detail',
    });

    // Ni RPC ni heurística: se conserva el 21 ya guardado.
    expect(contentPredictTenths).not.toHaveBeenCalled();
    const [row] = getUpsertCalls() as Array<Record<string, unknown>>;
    expect(row.ai_prediction_tenths).toBe(21);
  });
});

describe('rowToEntry', () => {
  it('mapea logged_at a loggedAt', () => {
    const { rowToEntry } = require('./mappers');
    const entry = rowToEntry({
      user_id: 'u1',
      key: 'movie:1',
      media_type: 'movie',
      media_id: 1,
      title: 'Test',
      genre_ids: [28],
      user_rating: 8,
      ai_prediction_tenths: 70,
      prediction_seen: false,
      source: 'app',
      rated_at: '2026-01-01T00:00:00Z',
      logged_at: '2026-01-01T12:00:00Z',
      season: null,
      episode: null,
    });
    expect(entry.loggedAt).toBe('2026-01-01T12:00:00Z');
  });

  it('loggedAt null cuando logged_at es null', () => {
    const { rowToEntry } = require('./mappers');
    const entry = rowToEntry({
      user_id: 'u1',
      key: 'movie:1',
      media_type: 'movie',
      media_id: 1,
      title: 'Test',
      genre_ids: [28],
      user_rating: 8,
      ai_prediction_tenths: 70,
      prediction_seen: false,
      source: 'app',
      rated_at: '2026-01-01T00:00:00Z',
      logged_at: null,
      season: null,
      episode: null,
    });
    expect(entry.loggedAt).toBeNull();
  });
});
