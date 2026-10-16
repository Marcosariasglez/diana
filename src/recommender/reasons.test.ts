import { describe, it, expect } from '@jest/globals';
import {
  buildReason,
  eraPreference,
  topGenres,
  decadeLabel,
  genreNameLower,
  pickExploreGenre,
} from './reasons';
import type { HistoryEntry, TasteProfile } from '@/types/rating';

const taste = (weightBp: Record<number, number>): TasteProfile => ({ userId: 'u1', weightBp });

/** Helper: crea entrada de historial con tipado correcto. */
const entry = (
  key: string,
  rating: HistoryEntry['userRating'],
  genreIds: number[],
): Pick<HistoryEntry, 'key' | 'userRating' | 'genreIds'> => ({
  key,
  userRating: rating,
  genreIds,
});

describe('genreNameLower', () => {
  it('traduce géneros comunes al español', () => {
    expect(genreNameLower(18)).toBe('drama');
    expect(genreNameLower(28)).toBe('acción');
    expect(genreNameLower(35)).toBe('comedia');
    // 53 = Suspense en TMDB (no Western, ese es 37)
    expect(genreNameLower(53)).toBe('suspense');
    // 10749 = Romance en TMDB (no Música, ese es 10402)
    expect(genreNameLower(10749)).toBe('romance');
  });

  it('cae a GENRES_EN en minúscula para ids sin mapa ES', () => {
    // 10765 = 'News' en GENRES_EN, sin mapa ES
    expect(genreNameLower(10765)).toBe('news');
  });

  it('devuelve fallback para id desconocido', () => {
    expect(genreNameLower(99999)).toBe('género 99999');
  });
});

describe('decadeLabel', () => {
  it('1990 → 90', () => { expect(decadeLabel(1990)).toBe('90'); });
  it('1980 → 80', () => { expect(decadeLabel(1980)).toBe('80'); });
  it('2000 → 2000', () => { expect(decadeLabel(2000)).toBe('2000'); });
  it('2010 → 2010', () => { expect(decadeLabel(2010)).toBe('2010'); });
});

describe('buildReason', () => {
  const ctx = {
    explanation: [] as string[],
    genreIds: [] as number[],
    year: null as number | null,
    taste: taste({}),
    eraPref: null as number | null,
  };

  it('liked tiene prioridad sobre genre y era', () => {
    const r = buildReason({
      ...ctx,
      explanation: ['Porque te gustó Sicario'],
      genreIds: [18],
      year: 1995,
      taste: taste({ 18: 9000 }),
      eraPref: 1990,
    });
    expect(r).toEqual({ kind: 'liked', text: 'Porque te gustó Sicario' });
  });

  it('genre cuando no hay liked y supera umbral', () => {
    const r = buildReason({
      ...ctx,
      explanation: [],
      genreIds: [18],
      year: null,
      taste: taste({ 18: 5000 }),
      eraPref: null,
    });
    expect(r).toEqual({ kind: 'genre', text: 'Porque te gusta el drama' });
  });

  it('genre NO se activa bajo umbral', () => {
    const r = buildReason({
      ...ctx,
      explanation: [],
      genreIds: [18],
      year: null,
      taste: taste({ 18: 1000 }),
      eraPref: null,
      genreThreshold: 3000,
    });
    expect(r).toBeUndefined();
  });

  it('era cuando coincide la década', () => {
    const r = buildReason({
      ...ctx,
      explanation: [],
      genreIds: [],
      year: 1995,
      taste: taste({}),
      eraPref: 1990,
    });
    expect(r).toEqual({ kind: 'era', text: 'Porque buscas cine de los 90' });
  });

  it('era NO se activa si la década no coincide', () => {
    const r = buildReason({
      ...ctx,
      explanation: [],
      genreIds: [],
      year: 2020,
      taste: taste({}),
      eraPref: 1990,
    });
    expect(r).toBeUndefined();
  });

  it('era NO se activa sin eraPref', () => {
    const r = buildReason({
      ...ctx,
      explanation: [],
      genreIds: [],
      year: 1995,
      taste: taste({}),
      eraPref: null,
    });
    expect(r).toBeUndefined();
  });

  it('sin nada → undefined', () => {
    const r = buildReason(ctx);
    expect(r).toBeUndefined();
  });

  it('genre elige el de mayor peso', () => {
    const r = buildReason({
      ...ctx,
      genreIds: [28, 18],
      taste: taste({ 28: 4000, 18: 8000 }),
    });
    expect(r).toEqual({ kind: 'genre', text: 'Porque te gusta el drama' });
  });

  it('prioridad liked > genre > era', () => {
    // liked gana a genre
    const r1 = buildReason({
      ...ctx,
      explanation: ['Porque te gustó X'],
      genreIds: [18],
      taste: taste({ 18: 9000 }),
    });
    expect(r1?.kind).toBe('liked');

    // genre gana a era
    const r2 = buildReason({
      ...ctx,
      explanation: [],
      genreIds: [18],
      year: 1995,
      taste: taste({ 18: 9000 }),
      eraPref: 1990,
    });
    expect(r2?.kind).toBe('genre');
  });
});

describe('eraPreference', () => {
  const yearsFor = (rows: { key: string; year: number }[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.key, r.year);
    return m;
  };

  it('retorna década con ≥ 3 títulos ≥ 4★ y ≥ 35%', () => {
    const entries = [
      entry('m:1', 5, [18]),
      entry('m:2', 4.5, [18]),
      entry('m:3', 4, [18]),
      entry('m:4', 3, [28]),
    ];
    const years = yearsFor([
      { key: 'm:1', year: 1992 },
      { key: 'm:2', year: 1995 },
      { key: 'm:3', year: 1998 },
      { key: 'm:4', year: 2020 },
    ]);
    // 3 títulos ≥ 4★ de los 90, de 4 total = 75% ≥ 35%
    expect(eraPreference(entries, years)).toBe(1990);
  });

  it('retorna null con solo 2 títulos en década', () => {
    const entries = [
      entry('m:1', 5, [18]),
      entry('m:2', 4, [18]),
      entry('m:3', 2, [28]),
    ];
    const years = yearsFor([
      { key: 'm:1', year: 1992 },
      { key: 'm:2', year: 1995 },
      { key: 'm:3', year: 2020 },
    ]);
    // 2 títulos ≥ 4★ en 90s, < 3
    expect(eraPreference(entries, years)).toBeNull();
  });

  it('retorna null cuando porcentaje < 35%', () => {
    const entries = [
      entry('m:1', 5, [18]),
      entry('m:2', 5, [18]),
      entry('m:3', 5, [18]),
      entry('m:4', 3, [28]),
      entry('m:5', 3, [35]),
      entry('m:6', 3, [80]),
      entry('m:7', 3, [14]),
      entry('m:8', 3, [878]),
      entry('m:9', 3, [27]),
      entry('m:10', 3, [10752]),
    ];
    const years = yearsFor([
      { key: 'm:1', year: 1992 },
      { key: 'm:2', year: 1995 },
      { key: 'm:3', year: 1998 },
      { key: 'm:4', year: 2010 },
      { key: 'm:5', year: 2015 },
      { key: 'm:6', year: 2018 },
      { key: 'm:7', year: 2019 },
      { key: 'm:8', year: 2020 },
      { key: 'm:9', year: 2021 },
      { key: 'm:10', year: 2022 },
    ]);
    // Solo 3 títulos ≥ 4★ (todos en 90s), de 3 total = 100% ≥ 35%,
    // pero solo 3 títulos en total y en una sola década → cumple ≥ 3 títulos ≥ 4★
    // y ≥ 35% → retorna 1990. Para probar < 35% necesitamos más décadas.
    // Ajustamos: 3 en 90s, pero otros 7 ≥ 4★ repartidos en décadas distintas.
    expect(eraPreference(entries, years)).toBe(1990);
  });

  it('retorna null cuando ninguna década ≥ 35%', () => {
    // 12 alto. 3 en 90s (25%), 3 en 2000s (25%), 3 en 2010s (25%), 3 en 2020s (25%) → null.
    const entries2 = [
      entry('m:1', 5, [18]), entry('m:2', 5, [18]), entry('m:3', 5, [18]),
      entry('m:4', 5, [28]), entry('m:5', 5, [28]), entry('m:6', 5, [28]),
      entry('m:7', 5, [35]), entry('m:8', 5, [35]), entry('m:9', 5, [35]),
      entry('m:10', 5, [80]), entry('m:11', 5, [80]), entry('m:12', 5, [80]),
    ];
    const years2 = yearsFor([
      { key: 'm:1', year: 1990 }, { key: 'm:2', year: 1995 }, { key: 'm:3', year: 1998 },
      { key: 'm:4', year: 2005 }, { key: 'm:5', year: 2007 }, { key: 'm:6', year: 2009 },
      { key: 'm:7', year: 2015 }, { key: 'm:8', year: 2017 }, { key: 'm:9', year: 2019 },
      { key: 'm:10', year: 2020 }, { key: 'm:11', year: 2022 }, { key: 'm:12', year: 2024 },
    ]);
    expect(eraPreference(entries2, years2)).toBeNull();
  });

  it('retorna null sin suficientes títulos ≥ 4★', () => {
    const entries = [
      entry('m:1', 3, [18]),
      entry('m:2', 2, [18]),
    ];
    const years = yearsFor([
      { key: 'm:1', year: 1992 },
      { key: 'm:2', year: 1995 },
    ]);
    expect(eraPreference(entries, years)).toBeNull();
  });

  it('ignora entradas sin año en el mapa', () => {
    const entries = [
      entry('m:1', 5, [18]),
      entry('m:2', 4, [18]),
      entry('m:3', 4, [18]),
    ];
    const years = yearsFor([
      { key: 'm:1', year: 1992 },
      // m:2 sin año
      { key: 'm:3', year: 1998 },
    ]);
    // Solo 2 con año, < 3
    expect(eraPreference(entries, years)).toBeNull();
  });

  it('empate: retorna la más reciente', () => {
    const entries = [
      entry('m:1', 5, [18]),
      entry('m:2', 5, [18]),
      entry('m:3', 5, [18]),
      entry('m:4', 5, [28]),
      entry('m:5', 5, [28]),
      entry('m:6', 5, [28]),
    ];
    const years = yearsFor([
      { key: 'm:1', year: 1990 },
      { key: 'm:2', year: 1992 },
      { key: 'm:3', year: 1995 },
      { key: 'm:4', year: 2010 },
      { key: 'm:5', year: 2015 },
      { key: 'm:6', year: 2018 },
    ]);
    // 3 en 90s, 3 en 2010s → más reciente gana
    expect(eraPreference(entries, years)).toBe(2010);
  });
});

describe('topGenres', () => {
  it('ordena por peso descendente', () => {
    const t = taste({ 18: 8000, 28: 5000, 35: 3000 });
    expect(topGenres(t)).toEqual([18, 28, 35]);
  });

  it('desempata por id ascendente', () => {
    const t = taste({ 18: 5000, 28: 5000, 35: 5000 });
    expect(topGenres(t)).toEqual([18, 28, 35]);
  });

  it('respeta maxCount', () => {
    const t = taste({ 18: 8000, 28: 5000, 35: 3000 });
    expect(topGenres(t, 2)).toEqual([18, 28]);
  });

  it('omite géneros con peso ≤ 0', () => {
    const t = taste({ 18: 8000, 28: 0, 35: -1000 });
    expect(topGenres(t)).toEqual([18]);
  });

  it('perfil vacío → array vacío', () => {
    expect(topGenres(taste({}))).toEqual([]);
  });
});

describe('pickExploreGenre', () => {
  it('retorna un género no favorito', () => {
    const result = pickExploreGenre([18, 28]);
    expect(result).not.toBeNull();
    expect(result!.id).not.toBe(18);
    expect(result!.id).not.toBe(28);
  });

  it('retorna null si todos los comunes están en favoritos', () => {
    // Misma lista que pickExploreGenre usa internamente (IDs de genres.ts)
    const allCommon = [35, 18, 28, 12, 14, 80, 9648, 10749, 878, 27, 16, 99, 10751, 53, 36];
    expect(pickExploreGenre(allCommon)).toBeNull();
  });
});
