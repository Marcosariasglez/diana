import type { HistoryEntry, InitialRating, TasteProfile } from '@/types/rating';
import { CATALOG, mediaKeyOf } from '@/mocks/data/catalog';
import { affinity, bucketOfTenths, buildTasteProfile, predict, predictTenths } from '@/mocks/mock-ai';

const ME = 'user-me';

// Perfil de ejemplo: un onboarding con gustos marcados (drama/romance/suspense) y rechazo de accion/comedia.
const ONBOARDING: Record<number, InitialRating> = {
  1: 'like',
  2: 'like',
  3: 'like',
  4: 'like',
  6: 'like',
  14: 'like',
  16: 'like',
  12: 'like',
  22: 'skip',
  23: 'skip',
  18: 'skip',
  21: 'skip',
  27: 'skip',
  38: 'skip',
  44: 'unseen',
  31: 'unseen',
};

const historyEntry = (mediaId: number, userRating: HistoryEntry['userRating']): HistoryEntry => ({
  key: `movie:${mediaId}`,
  ref: { mediaType: 'movie', mediaId },
  title: 't',
  posterColor: '#000000',
  userRating,
  aiPrediction: 3,
  predictionSeen: false,
  ratedAt: '2024-01-01T00:00:00.000Z',
  source: 'app',
});

const profiles: Record<string, TasteProfile> = {
  vacio: buildTasteProfile(ME, {}, []),
  P1: buildTasteProfile(ME, ONBOARDING, []),
  'P1 + historial': buildTasteProfile(ME, ONBOARDING, [
    historyEntry(40, 5),
    historyEntry(19, 4.5),
    historyEntry(29, 1),
  ]),
};

describe.each(Object.entries(profiles))('coherencia afinidad/prediccion (%s)', (_name, profile) => {
  it('afinidad igual a bucketOfTenths(predictTenths) y consistente con los umbrales', () => {
    for (const media of CATALOG) {
      const key = mediaKeyOf(media);
      const t = predictTenths(profile, media, key);
      const a = affinity(profile, media, key);
      expect(a).toBe(bucketOfTenths(t));
      if (a === 'alto') expect(t).toBeGreaterThanOrEqual(40);
      if (a === 'medio') {
        expect(t).toBeGreaterThanOrEqual(30);
        expect(t).toBeLessThanOrEqual(39);
      }
      if (a === 'bajo') expect(t).toBeLessThan(30);
    }
  });

  it('el orden por predictTenths nunca contradice el orden por bucket', () => {
    const rank = { alto: 2, medio: 1, bajo: 0 } as const;
    const rows = CATALOG.map((m) => {
      const key = mediaKeyOf(m);
      return { t: predictTenths(profile, m, key), b: rank[affinity(profile, m, key)] };
    }).sort((x, y) => y.t - x.t);
    for (let i = 1; i < rows.length; i++) expect(rows[i].b).toBeLessThanOrEqual(rows[i - 1].b);
  });

  it('toda prediccion esta en [1,0, 5,0] con un decimal', () => {
    for (const media of CATALOG) {
      const p = predict(profile, media, mediaKeyOf(media));
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(5);
      expect(Number.isInteger(p * 10)).toBe(true);
    }
  });
});

describe('calibracion', () => {
  it('con el perfil de ejemplo al menos 15% alto y 15% bajo', () => {
    const buckets = CATALOG.map((m) => affinity(profiles.P1, m, mediaKeyOf(m)));
    const alto = buckets.filter((b) => b === 'alto').length / buckets.length;
    const bajo = buckets.filter((b) => b === 'bajo').length / buckets.length;
    expect(alto).toBeGreaterThanOrEqual(0.15);
    expect(bajo).toBeGreaterThanOrEqual(0.15);
  });
});
