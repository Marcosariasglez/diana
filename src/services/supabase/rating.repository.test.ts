/// <reference types="jest" />
/**
 * C1: Test del reintento sin logged_at (defensa PGRST204).
 *
 * Verifica que si el upsert falla por columna logged_at inexistente
 * (migración 0023 pendiente), el repositorio reintenta una vez sin
 * logged_at para no romper la app en vuelo.
 */

import type { Rating } from '@/types/rating';

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
jest.mock('@/mocks/mock-ai/predict', () => ({ predictTenths: () => 65 }));
jest.mock('@/mocks/mock-ai/taste', () => ({ buildTasteProfile: () => ({ genreBoosts: new Map() }) }));
jest.mock('@/mocks/data/catalog', () => ({ titleOf: () => 'Test Movie' }));
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
