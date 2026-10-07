import type { HistoryEntry } from '@/types/rating';
import type { ImportResult } from '@/types/import';
import { getMedia } from '@/mocks/data/catalog';
import { predict } from '@/mocks/mock-ai/predict';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import {
  selectAverageRating,
  selectEntryByKey,
  selectSeenCount,
  useHistoryStore,
} from './useHistoryStore';
import { createDefaultProfile, useProfileStore } from './useProfileStore';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

const AFTERSUN = { mediaType: 'movie' as const, mediaId: 1 };
const PAST_LIVES = { mediaType: 'movie' as const, mediaId: 2 };
const FALLOUT_E3 = { mediaType: 'tv' as const, mediaId: 8, season: 1, episode: 3 };

function entry(partial: Partial<HistoryEntry> & Pick<HistoryEntry, 'key'>): HistoryEntry {
  return {
    ref: { mediaType: 'movie', mediaId: 1 },
    title: 'X',
    posterColor: '#000000',
    userRating: 3,
    aiPrediction: 3,
    predictionSeen: false,
    ratedAt: '2025-01-01T00:00:00.000Z',
    source: 'app',
    ...partial,
  };
}

beforeEach(() => {
  useProfileStore.setState({ profile: createDefaultProfile() });
  useHistoryStore.setState({ entries: [], watched: [] });
});

describe('useHistoryStore.addEntry (reglas 1-8 de 6.1)', () => {
  it('entrada nueva desde la Ficha: predictionSeen true', async () => {
    const e = await useHistoryStore.getState().addEntry({ mediaRef: AFTERSUN, userRating: 4.5, origin: 'detail' });
    expect(e.key).toBe('movie:1');
    expect(e.predictionSeen).toBe(true);
    expect(e.source).toBe('app');
    expect(e.userRating).toBe(4.5);
    expect(e.title).toBe('Aftersun');
    expect(useHistoryStore.getState().entries).toHaveLength(1);
  });

  it('entrada nueva desde el Diario rapido: predictionSeen false', async () => {
    const e = await useHistoryStore.getState().addEntry({ mediaRef: AFTERSUN, userRating: 4, origin: 'daily-log' });
    expect(e.predictionSeen).toBe(false);
  });

  it('aiPrediction la calcula el repositorio con el perfil previo (1-5, un decimal)', async () => {
    useProfileStore.setState({
      profile: { ...createDefaultProfile(), initialRatings: { 3: 'like', 4: 'like' } },
    });
    const e = await useHistoryStore.getState().addEntry({ mediaRef: AFTERSUN, userRating: 5, origin: 'detail' });
    const taste = buildTasteProfile('user-me', { 3: 'like', 4: 'like' }, []);
    expect(e.aiPrediction).toBe(predict(taste, getMedia('movie', 1)!, 'movie:1'));
    expect(e.aiPrediction).toBeGreaterThanOrEqual(1);
    expect(e.aiPrediction).toBeLessThanOrEqual(5);
    expect(Math.round(e.aiPrediction * 10)).toBe(e.aiPrediction * 10);
  });

  it('la nota nueva no empuja su propia prediccion; la siguiente si usa la anterior', async () => {
    const store = useHistoryStore.getState();
    const first = await store.addEntry({ mediaRef: AFTERSUN, userRating: 5, origin: 'detail' });
    // Perfil previo vacio: la primera prediccion no depende de la nota 5,0.
    expect(first.aiPrediction).toBe(predict(buildTasteProfile('user-me', {}, []), getMedia('movie', 1)!, 'movie:1'));
    const second = await store.addEntry({ mediaRef: PAST_LIVES, userRating: 3, origin: 'detail' });
    const taste = buildTasteProfile('user-me', {}, [first]);
    expect(second.aiPrediction).toBe(predict(taste, getMedia('movie', 2)!, 'movie:2'));
  });

  it('upsert: actualiza nota y fecha, conserva aiPrediction y no duplica', async () => {
    const store = useHistoryStore.getState();
    const first = await store.addEntry({ mediaRef: AFTERSUN, userRating: 3, origin: 'daily-log' });
    useProfileStore.setState({ profile: { ...createDefaultProfile(), initialRatings: { 3: 'like', 4: 'like' } } });
    const second = await store.addEntry({ mediaRef: AFTERSUN, userRating: 5, origin: 'daily-log' });
    expect(useHistoryStore.getState().entries).toHaveLength(1);
    expect(second.userRating).toBe(5);
    expect(second.aiPrediction).toBe(first.aiPrediction);
    expect(second.ratedAt >= first.ratedAt).toBe(true);
  });

  it('predictionSeen nunca vuelve de true a false', async () => {
    const store = useHistoryStore.getState();
    await store.addEntry({ mediaRef: AFTERSUN, userRating: 3, origin: 'detail' });
    const again = await store.addEntry({ mediaRef: AFTERSUN, userRating: 4, origin: 'daily-log' });
    expect(again.predictionSeen).toBe(true);
  });

  it('predictionSeen pasa de false a true al guardar desde la Ficha', async () => {
    const store = useHistoryStore.getState();
    const a = await store.addEntry({ mediaRef: AFTERSUN, userRating: 3, origin: 'daily-log' });
    expect(a.predictionSeen).toBe(false);
    const b = await store.addEntry({ mediaRef: AFTERSUN, userRating: 3.5, origin: 'detail' });
    expect(b.predictionSeen).toBe(true);
  });

  it('capitulo: clave tv:8:s1:e3 y titulo con temporada y episodio', async () => {
    const e = await useHistoryStore.getState().addEntry({ mediaRef: FALLOUT_E3, userRating: 4, origin: 'daily-log' });
    expect(e.key).toBe('tv:8:s1:e3');
    expect(e.title).toBe('Fallout T1 · E3');
    expect(e.ref).toEqual(FALLOUT_E3);
  });

  it('titulo inexistente rechaza', async () => {
    await expect(
      useHistoryStore
        .getState()
        .addEntry({ mediaRef: { mediaType: 'movie', mediaId: 9999 }, userRating: 3, origin: 'detail' }),
    ).rejects.toThrow('media-not-found');
  });
});

describe('useHistoryStore importResult, removeEntry y selectores', () => {
  const result = (entries: HistoryEntry[], watched: string[]): ImportResult => ({
    totalRows: entries.length,
    matched: entries.length,
    unmatched: 0,
    alreadyPresent: 0,
    watchedOnlyMatched: watched.length,
    entries,
    watched,
  });

  it('importResult anade entradas y watched sin duplicar claves', () => {
    useHistoryStore.setState({ entries: [entry({ key: 'movie:1' })], watched: ['movie:9'] });
    useHistoryStore
      .getState()
      .importResult(result([entry({ key: 'movie:1', userRating: 5 }), entry({ key: 'movie:2' })], ['movie:9', 'movie:10']));
    const { entries, watched } = useHistoryStore.getState();
    expect(entries.map((e) => e.key).sort()).toEqual(['movie:1', 'movie:2']);
    expect(entries.find((e) => e.key === 'movie:1')?.userRating).toBe(3);
    expect(watched.sort()).toEqual(['movie:10', 'movie:9']);
  });

  it('removeEntry elimina por clave', () => {
    useHistoryStore.setState({ entries: [entry({ key: 'movie:1' }), entry({ key: 'movie:2' })] });
    useHistoryStore.getState().removeEntry('movie:1');
    expect(useHistoryStore.getState().entries.map((e) => e.key)).toEqual(['movie:2']);
  });

  it('selectEntryByKey', () => {
    useHistoryStore.setState({ entries: [entry({ key: 'movie:1' })] });
    expect(selectEntryByKey('movie:1')(useHistoryStore.getState())?.key).toBe('movie:1');
    expect(selectEntryByKey('movie:7')(useHistoryStore.getState())).toBeUndefined();
  });

  it('selectAverageRating: null sin entradas y media con ellas', () => {
    expect(selectAverageRating(useHistoryStore.getState())).toBeNull();
    useHistoryStore.setState({
      entries: [entry({ key: 'movie:1', userRating: 4 }), entry({ key: 'movie:2', userRating: 3.5 })],
    });
    expect(selectAverageRating(useHistoryStore.getState())).toBe(3.75);
  });

  it('selectSeenCount cuenta claves unicas de entries y watched', () => {
    useHistoryStore.setState({
      entries: [entry({ key: 'movie:1' }), entry({ key: 'movie:2' })],
      watched: ['movie:2', 'movie:3'],
    });
    expect(selectSeenCount(useHistoryStore.getState())).toBe(3);
  });
});
