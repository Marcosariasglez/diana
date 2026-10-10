/// <reference types="jest" />
/**
 * VERTICE-PLAN-2 D2-1.8: pruebas (fixtures) de la lógica de cobertura del
 * catálogo. Sin TMDB ni Supabase: solo las funciones puras.
 */
import {
  ABS_MIN_MISSING,
  BYTES_PER_ROW,
  DB_LIMIT_MB,
  coverageVerdict,
  estimateDbSizeMB,
  maxRowsWithinLimit,
  parseProvidersSource,
  syncableProviders,
} from './catalogCoverage';

describe('coverageVerdict (D2-1.8)', () => {
  it('cobera completa: ok', () => {
    const v = coverageVerdict(1000, 1000);
    expect(v.ok).toBe(true);
    expect(v.missing).toBe(0);
    expect(v.reason).toBe('ok');
  });

  it('falta menos del 5 %: ok', () => {
    // 1000 * 0.95 = 950 → 951 ok, 949 falla.
    expect(coverageVerdict(1000, 951).ok).toBe(true);
    expect(coverageVerdict(1000, 949).ok).toBe(false);
  });

  it('falta más del 5 %: falla', () => {
    const v = coverageVerdict(2000, 1500);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('falta-más-del-5%');
    expect(v.missing).toBe(500);
  });

  it('margen absoluto: catálogos pequeños no fallan por pocos títulos', () => {
    // Faltan 10 < ABS_MIN_MISSING (20) → ok aunque sean el 33 %.
    const v = coverageVerdict(30, 20);
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('margen-absoluto');
    // Faltan 25 > 20 y es el 20 % → falla.
    expect(coverageVerdict(300, 240).ok).toBe(false);
  });

  it('TMDB vacío: no se falla (aún no hay nada que comparar)', () => {
    const v = coverageVerdict(0, 0);
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('tmdb-vacío');
  });
});

describe('estimación de tamaño (D2-1.8)', () => {
  it('filas × bytes / MB', () => {
    expect(estimateDbSizeMB(1024 * 1024)).toBeCloseTo(BYTES_PER_ROW, 1);
    expect(estimateDbSizeMB(1_000_000)).toBeGreaterThan(0);
  });

  it('el catálogo completo ES cabe de sobra en el límite de 500 MB', () => {
    // Cifra realista: ~150k títulos (películas + series de ES) × 0.45 KB ≈ 67 MB.
    const realistic = 150_000;
    expect(estimateDbSizeMB(realistic)).toBeLessThan(DB_LIMIT_MB * 0.2);
    // Y el máximo de filas antes de superar el límite.
    expect(maxRowsWithinLimit()).toBeGreaterThan(realistic);
  });
});

describe('parseProvidersSource + syncableProviders (D2-1.8)', () => {
  const FIXTURE = `
export const PROVIDERS = [
  { id: 'netflix', name: 'Netflix', tmdbProviderId: 8, es: true },
  { id: 'filmin', name: 'Filmin', tmdbProviderId: 63, es: true },
  { id: 'movistar-plus', name: 'Movistar Plus', tmdbProviderId: null, es: true },
  { id: 'peacock', name: 'Peacock', tmdbProviderId: 155, es: false },
];
`;

  it('extrae id, tmdbProviderId (null incluido) y es', () => {
    const all = parseProvidersSource(FIXTURE);
    expect(all).toEqual([
      { id: 'netflix', tmdbProviderId: 8, es: true },
      { id: 'filmin', tmdbProviderId: 63, es: true },
      { id: 'movistar-plus', tmdbProviderId: null, es: true },
      { id: 'peacock', tmdbProviderId: 155, es: false },
    ]);
  });

  it('syncableProviders: solo ES con id TMDB verificado', () => {
    const syncable = syncableProviders(parseProvidersSource(FIXTURE));
    expect(syncable.map((p) => p.id)).toEqual(['netflix', 'filmin']);
  });

  it('acepta un parser inyectado (tests)', () => {
    const custom = parseProvidersSource('x', () => [{ id: 'fake', tmdbProviderId: 1, es: true }]);
    expect(custom).toEqual([{ id: 'fake', tmdbProviderId: 1, es: true }]);
  });
});

describe('constantes (D2-1.8)', () => {
  it('tolerancia 5 % y margen absoluto 20', () => {
    expect(coverageVerdict(1000, 950 + 1).ok).toBe(true);
    expect(coverageVerdict(1000, 950).ok).toBe(true); // ceil(950)=950
    expect(ABS_MIN_MISSING).toBe(20);
    expect(DB_LIMIT_MB).toBe(500);
  });
});
