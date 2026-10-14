import { diaryEntries, groupByDay } from './diaryLogic';
import type { HistoryEntry } from '@/types/rating';

function makeEntry(loggedAt: string | null, title = 'Test'): HistoryEntry {
  return {
    key: `movie:1`,
    ref: { mediaType: 'movie', mediaId: 1 },
    title,
    posterColor: '#000',
    userRating: 4,
    aiPrediction: 4,
    predictionSeen: false,
    ratedAt: new Date().toISOString(),
    source: 'app',
    loggedAt,
  };
}

describe('diaryEntries', () => {
  it('filtra entradas sin loggedAt', () => {
    const entries: HistoryEntry[] = [
      makeEntry('2026-10-13T10:00:00Z', 'Con loggedAt'),
      makeEntry(null, 'Sin loggedAt'),
      makeEntry('2026-10-12T10:00:00Z', 'Con loggedAt 2'),
    ];
    const result = diaryEntries(entries);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.title)).toEqual(['Con loggedAt', 'Con loggedAt 2']);
  });

  it('ordena por loggedAt descendente', () => {
    const entries: HistoryEntry[] = [
      makeEntry('2026-10-10T10:00:00Z', 'Antigua'),
      makeEntry('2026-10-13T10:00:00Z', 'Reciente'),
      makeEntry('2026-10-12T10:00:00Z', 'Mediana'),
    ];
    const result = diaryEntries(entries);
    expect(result.map((e) => e.title)).toEqual(['Reciente', 'Mediana', 'Antigua']);
  });

  it('retorno vacio sin entradas', () => {
    expect(diaryEntries([])).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('etiqueta "Hoy" para entradas del dia actual', () => {
    const now = new Date('2026-10-13T12:00:00');
    const entries = [makeEntry('2026-10-13T08:00:00')];
    const groups = groupByDay(entries, now);
    expect(groups[0].label).toBe('Hoy');
  });

  it('etiqueta "Ayer" para entradas del dia anterior', () => {
    const now = new Date('2026-10-13T12:00:00');
    const entries = [makeEntry('2026-10-12T08:00:00')];
    const groups = groupByDay(entries, now);
    expect(groups[0].label).toBe('Ayer');
  });

  it('etiqueta fecha corta para dias anteriores', () => {
    const now = new Date('2026-10-13T12:00:00');
    const entries = [makeEntry('2026-10-10T08:00:00')];
    const groups = groupByDay(entries, now);
    expect(groups[0].label).toMatch(/\d+ [a-z]+\s*\d{4}/);
  });

  it('agrupa varias entradas del mismo dia', () => {
    const now = new Date('2026-10-13T12:00:00');
    const entries = [
      makeEntry('2026-10-13T08:00:00', 'Mañana'),
      makeEntry('2026-10-13T20:00:00', 'Noche'),
    ];
    const groups = groupByDay(entries, now);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Hoy');
    expect(groups[0].entries).toHaveLength(2);
  });

  it('respetar límite de medianoche', () => {
    // Entrada justo antes de medianoche cuenta como "Hoy"
    const now = new Date('2026-10-13T00:00:01');
    const entries = [makeEntry('2026-10-12T23:59:59')];
    const groups = groupByDay(entries, now);
    expect(groups[0].label).toBe('Ayer');
  });
});
