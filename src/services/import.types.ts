// P9 (F4-2): tipos y helpers extraídos del repositorio mock import.repository.ts
// antes de borrarlo. El TMDB import (tmdb/import.repository.ts) usa los mismos
// helpers puros (parseRating, ratedAtOf, readFile, ImportError) que se reutilizan.
import type { ImportErrorCode, ImportPhase, ImportProgress, ImportResult } from '@/types/import';
import type { Rating } from '@/types/rating';
export interface ImportRepository {
  parseLetterboxd(
    file: { uri: string; name: string },
    opts?: { onProgress?: (p: ImportProgress) => void },
  ): Promise<ImportResult>;
}

export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, string> = {
  'unsupported-type': 'Solo se admiten archivos .csv o .zip de Letterboxd.',
  'too-large': 'El archivo supera los 5 MB. Sube solo ratings.csv o el zip del export.',
  empty: 'El archivo está vacío.',
  'zip-without-data': 'No encontramos ratings.csv ni watched.csv dentro del zip.',
  'missing-columns': 'El archivo no tiene el formato de Letterboxd (faltan columnas).',
  'read-failed': 'No pudimos leer el archivo. Inténtalo de nuevo.',
  'no-matches': 'No encontramos ninguna película de tu archivo en nuestro catálogo.',
};

/** Error de importacion: `code` es un ImportErrorCode y `message` el texto en espanol. */
export class ImportError extends Error {
  readonly code: ImportErrorCode;
  constructor(code: ImportErrorCode) {
    super(IMPORT_ERROR_MESSAGES[code]);
    this.name = 'ImportError';
    this.code = code;
  }
}

/** Tolerancia de anio respecto al de Letterboxd. */
export const IMPORT_YEAR_TOLERANCE = 1;

export type CsvRow = Record<string, string | undefined>;

export interface ParsedCsv {
  fields: string[];
  rows: CsvRow[];
}

export function parseRating(raw: string | undefined): Rating | null {
  const n = Number((raw ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0.5 || n > 5) return null;
  return (Math.round(n * 2) / 2) as Rating;
}

export function ratedAtOf(date: string | undefined): string {
  const d = date ? new Date(date) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

export type Report = (phase: ImportPhase, processed?: number, total?: number) => void;

// readFile se mantiene en tmdb/import.repository.ts ya que depende de openFile (file system).
// La referencia se importa desde allí.
