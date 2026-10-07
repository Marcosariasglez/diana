import type { HistoryEntry } from '@/types/rating';
import type { ImportResult } from '@/types/import';
import {
  HISTORY_PAGE_SIZE,
  detailHref,
  importSummary,
  paginateHistory,
  sortHistory,
} from './profileLogic';

const mk = (
  i: number,
  ratedAt: string,
  ref: HistoryEntry['ref'] = { mediaType: 'movie', mediaId: i },
): HistoryEntry => ({
  key: `k${i}`,
  ref,
  title: `T${i}`,
  posterColor: '#000',
  userRating: 4,
  aiPrediction: 3,
  predictionSeen: true,
  ratedAt,
  source: 'app',
});

describe('profileLogic', () => {
  it('ordena por ratedAt descendente sin mutar', () => {
    const a = [mk(1, '2026-01-01T00:00:00Z'), mk(2, '2026-03-01T00:00:00Z'), mk(3, '2026-02-01T00:00:00Z')];
    expect(sortHistory(a).map((e) => e.key)).toEqual(['k2', 'k3', 'k1']);
    expect(a[0].key).toBe('k1');
  });

  it('pagina de 50 en 50', () => {
    const a = Array.from({ length: 120 }, (_, i) => mk(i, new Date(2026, 0, 1 + i).toISOString()));
    expect(HISTORY_PAGE_SIZE).toBe(50);
    expect(paginateHistory(a, 1).visible).toHaveLength(50);
    expect(paginateHistory(a, 1).hasMore).toBe(true);
    expect(paginateHistory(a, 2).visible).toHaveLength(100);
    const p3 = paginateHistory(a, 3);
    expect(p3.visible).toHaveLength(120);
    expect(p3.hasMore).toBe(false);
    expect(paginateHistory([], 1)).toEqual({ visible: [], hasMore: false });
  });

  it('resumen de importacion', () => {
    const r = { matched: 12, unmatched: 3, alreadyPresent: 0 } as ImportResult;
    expect(importSummary(r)).toBe('Importadas 12 valoraciones. 3 sin coincidencia.');
    expect(importSummary({ ...r, alreadyPresent: 4 })).toBe(
      'Importadas 12 valoraciones. 3 sin coincidencia. 4 ya estaban en tu historial.',
    );
  });

  it('ruta de detalle con type, season y episode', () => {
    expect(detailHref(mk(1, 'x'))).toEqual({
      pathname: '/detail/[id]',
      params: { id: '1', type: 'movie' },
    });
    const h = detailHref(mk(7, 'x', { mediaType: 'tv', mediaId: 7, season: 1, episode: 3 })) as {
      params: Record<string, string>;
    };
    expect(h.params).toEqual({ id: '7', type: 'tv', season: '1', episode: '3' });
  });
});
