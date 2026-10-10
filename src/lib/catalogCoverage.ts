/**
 * VERTICE-PLAN-2 D2-1.8: lógica PURA de comprobación de cobertura del
 * catálogo (fuente de verdad; scripts/verify-catalog.mjs la replica porque
 * Node no puede importar .ts). Testeada con fixtures en
 * src/lib/catalogCoverage.test.ts.
 */

export const DB_LIMIT_MB = 500;
/** Bytes estimados por fila en disco (columnas + GIN/fts/trgm) — estimación
 *  conservadora documentada: title/overview/arrays/índices ≈ 0.45 KB. */
export const BYTES_PER_ROW = 450;
export const TOLERANCE = 0.05;
/** Margen absoluto: no se falla por menos de N títulos (catálogos pequeños). */
export const ABS_MIN_MISSING = 20;

export interface CoverageVerdict {
  ok: boolean;
  missing: number;
  reason: 'tmdb-vacío' | 'margen-absoluto' | 'ok' | 'falta-más-del-5%';
}

/**
 * Decide si la base tiene cobertura suficiente frente a TMDB.
 * `tmdbTotal` = total_results de discover; `dbRows` = filas que llevan el
 * proveedor en su array. Falla si faltan más del 5 % (y más de ABS_MIN_MISSING).
 */
export function coverageVerdict(tmdbTotal: number, dbRows: number): CoverageVerdict {
  const missing = Math.max(0, tmdbTotal - dbRows);
  if (tmdbTotal <= 0) return { ok: true, missing: 0, reason: 'tmdb-vacío' };
  if (missing === 0) return { ok: true, missing: 0, reason: 'ok' };
  if (missing <= ABS_MIN_MISSING) return { ok: true, missing, reason: 'margen-absoluto' };
  const failAt = Math.ceil(tmdbTotal * (1 - TOLERANCE));
  return dbRows >= failAt
    ? { ok: true, missing, reason: 'ok' }
    : { ok: false, missing, reason: 'falta-más-del-5%' };
}

/** Tamaño estimado de `catalog_titles` en MB para `rows` filas. */
export function estimateDbSizeMB(rows: number): number {
  return (rows * BYTES_PER_ROW) / (1024 * 1024);
}

/** ¿Cuántas filas caben en el límite antes de superarlo? (para el informe) */
export function maxRowsWithinLimit(mb = DB_LIMIT_MB): number {
  return Math.floor((mb * 1024 * 1024) / BYTES_PER_ROW);
}

export interface ParsedProvider {
  id: string;
  tmdbProviderId: number | null;
  es: boolean;
}

/**
 * Extrae los proveedores del código fuente de src/constants/providers.ts
 * (formato conocido: `id: 'x', … tmdbProviderId: N|null, … es: true|false`).
 * `parse` es inyectable para tests con fixtures.
 */
export function parseProvidersSource(src: string, parse?: (s: string) => ParsedProvider[]): ParsedProvider[] {
  if (parse) return parse(src);
  const out: ParsedProvider[] = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?tmdbProviderId:\s*(\d+|null)[\s\S]*?es:\s*(true|false)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ id: m[1], tmdbProviderId: m[2] === 'null' ? null : Number(m[2]), es: m[3] === 'true' });
  }
  return out;
}

/** Solo los proveedores ES con id TMDB verificado (los que sincroniza catalog-sync). */
export function syncableProviders(all: readonly ParsedProvider[]): ParsedProvider[] {
  return all.filter((p) => p.es && p.tmdbProviderId !== null);
}
