import JSZip from 'jszip';
import { openFile, type OpenedFile } from './openFile';
import Papa from 'papaparse';
import type { ImportErrorCode, ImportPhase, ImportProgress, ImportResult } from '@/types/import';
import type { HistoryEntry, MediaKey, Rating } from '@/types/rating';
import type { Movie } from '@/types/media';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from '@/constants/import';
import { MOVIES, releaseYearOf } from '@/mocks/data/catalog';
import { predict } from '@/mocks/mock-ai/predict';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { buildMediaKey } from '@/utils/mediaKey';
import { normalizeTitle } from '@/utils/normalizeTitle';
import { posterColor } from '@/utils/posterColor';

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
  'no-matches': 'No encontramos ninguna película de tu archivo en nuestro catálogo de prueba.',
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
const BATCH = 500;

export type CsvRow = Record<string, string | undefined>;

export interface ParsedCsv {
  fields: string[];
  rows: CsvRow[];
}

const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

function parseCsv(text: string): ParsedCsv {
  const clean = stripBom(text);
  if (clean.trim() === '') throw new ImportError('empty');
  const result = Papa.parse<CsvRow>(clean, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.data.length > MAX_IMPORT_ROWS) throw new ImportError('too-large');
  return { fields: result.meta.fields ?? [], rows: result.data };
}

const hasColumns = (p: ParsedCsv, cols: string[]) => cols.every((c) => p.fields.includes(c));

/** Localiza `name` en la raiz del zip o en una unica subcarpeta; la raiz tiene prioridad. */
function findInZip(zip: JSZip, name: string): JSZip.JSZipObject | null {
  let nested: JSZip.JSZipObject | null = null;
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const parts = path.split('/').filter(Boolean);
    if (parts[parts.length - 1]?.toLowerCase() !== name) continue;
    if (parts.length === 1) return entry;
    if (parts.length === 2 && !parts[0].startsWith('__MACOSX') && !nested) nested = entry;
  }
  return nested;
}

async function readZipText(entry: JSZip.JSZipObject): Promise<string> {
  const text = await entry.async('string');
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError('too-large');
  return text;
}

function buildIndex(): Map<string, Movie[]> {
  const byTitle = new Map<string, Movie[]>();
  for (const movie of MOVIES) {
    for (const name of [movie.title, ...movie.alt_titles]) {
      const k = normalizeTitle(name);
      const list = byTitle.get(k) ?? [];
      if (!list.includes(movie)) list.push(movie);
      byTitle.set(k, list);
    }
  }
  return byTitle;
}

/** Cruce por titulo normalizado (title o alt_titles) y anio con tolerancia +-1; gana el anio mas cercano. */
function matchMovie(index: Map<string, Movie[]>, row: CsvRow): Movie | null {
  const name = row.Name;
  const year = Number(row.Year);
  if (!name || !Number.isFinite(year)) return null;
  const candidates = index.get(normalizeTitle(name));
  if (!candidates) return null;
  let best: Movie | null = null;
  let bestDiff = Infinity;
  for (const c of candidates) {
    const diff = Math.abs(releaseYearOf(c) - year);
    if (diff > IMPORT_YEAR_TOLERANCE) continue;
    if (diff < bestDiff || (diff === bestDiff && best !== null && c.id < best.id)) {
      best = c;
      bestDiff = diff;
    }
  }
  return best;
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

export async function readFile(
  file: { uri: string; name: string },
  report: Report,
): Promise<{ ratings: ParsedCsv | null; watched: ParsedCsv | null }> {
  const lower = file.name.toLowerCase();
  const isZip = lower.endsWith('.zip');
  if (!isZip && !lower.endsWith('.csv')) throw new ImportError('unsupported-type');

  report('reading');
  let size: number;
  let handle: OpenedFile;
  try {
    handle = await openFile(file.uri);
    size = handle.size;
  } catch {
    throw new ImportError('read-failed');
  }
  if (size > MAX_IMPORT_BYTES) throw new ImportError('too-large');
  if (size === 0) throw new ImportError('empty');

  if (!isZip) {
    let text: string;
    try {
      text = await handle.text();
    } catch {
      throw new ImportError('read-failed');
    }
    if (text.length > MAX_IMPORT_BYTES) throw new ImportError('too-large');
    report('parsing');
    const parsed = parseCsv(text);
    // Un .csv suelto es ratings.csv (tiene Rating) o watched.csv.
    if (hasColumns(parsed, ['Name', 'Year', 'Rating'])) return { ratings: parsed, watched: null };
    if (hasColumns(parsed, ['Name', 'Year'])) return { ratings: null, watched: parsed };
    throw new ImportError('missing-columns');
  }

  report('unzipping');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await handle.bytes());
  } catch {
    throw new ImportError('read-failed');
  }
  const ratingsEntry = findInZip(zip, 'ratings.csv');
  const watchedEntry = findInZip(zip, 'watched.csv');
  if (!ratingsEntry && !watchedEntry) throw new ImportError('zip-without-data');

  report('parsing');
  let ratings: ParsedCsv | null = null;
  let watched: ParsedCsv | null = null;
  try {
    if (ratingsEntry) ratings = parseCsv(await readZipText(ratingsEntry));
    if (watchedEntry) watched = parseCsv(await readZipText(watchedEntry));
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('read-failed');
  }
  if (ratings && !hasColumns(ratings, ['Name', 'Year', 'Rating'])) throw new ImportError('missing-columns');
  if (watched && !hasColumns(watched, ['Name', 'Year'])) throw new ImportError('missing-columns');
  return { ratings, watched };
}

export const importRepository: ImportRepository = {
  async parseLetterboxd(file, opts) {
    const onProgress = opts?.onProgress;
    const report: Report = (phase, processed = 0, total = 0) => onProgress?.({ phase, processed, total });

    const { ratings, watched } = await readFile(file, report);
    const ratingRows = ratings?.rows ?? [];
    const watchedRows = watched?.rows ?? [];
    const total = ratingRows.length + watchedRows.length;

    // Perfil previo a la importacion (misma regla que addEntry).
    const { profile } = useProfileStore.getState();
    const history = useHistoryStore.getState();
    const existingKeys = new Set<MediaKey>(history.entries.map((e) => e.key));
    const existingWatched = new Set<MediaKey>(history.watched);
    const taste = buildTasteProfile(profile.id, profile.initialRatings, history.entries);
    const index = buildIndex();

    const entries: HistoryEntry[] = [];
    const newKeys = new Set<MediaKey>();
    let crossed = 0;
    let unmatched = 0;
    let alreadyPresent = 0;
    let processed = 0;

    report('matching', 0, total);
    for (const row of ratingRows) {
      const movie = matchMovie(index, row);
      const rating = parseRating(row.Rating);
      if (!movie || rating === null) {
        unmatched++;
      } else {
        crossed++;
        const key = buildMediaKey({ mediaType: 'movie', mediaId: movie.id });
        if (existingKeys.has(key) || newKeys.has(key)) {
          alreadyPresent++;
        } else {
          newKeys.add(key);
          entries.push({
            key,
            ref: { mediaType: 'movie', mediaId: movie.id },
            title: movie.title,
            posterColor: posterColor(movie.id),
            userRating: rating,
            aiPrediction: predict(taste, movie, key),
            predictionSeen: false,
            ratedAt: ratedAtOf(row.Date),
            source: 'letterboxd',
          });
        }
      }
      if (++processed % BATCH === 0) {
        report('matching', processed, total);
        await Promise.resolve();
      }
    }

    const watchedKeys: MediaKey[] = [];
    const watchedSeen = new Set<MediaKey>();
    for (const row of watchedRows) {
      const movie = matchMovie(index, row);
      if (movie) {
        const key = buildMediaKey({ mediaType: 'movie', mediaId: movie.id });
        crossed++;
        // Solo "vistos sin nota": no cuenta si ya tiene nota (existente o importada).
        if (!existingKeys.has(key) && !newKeys.has(key) && !watchedSeen.has(key)) {
          watchedSeen.add(key);
          if (!existingWatched.has(key)) watchedKeys.push(key);
        }
      }
      if (++processed % BATCH === 0) {
        report('matching', processed, total);
        await Promise.resolve();
      }
    }

    if (crossed === 0) throw new ImportError('no-matches');
    report('done', total, total);
    return {
      totalRows: ratingRows.length,
      matched: entries.length,
      unmatched,
      alreadyPresent,
      watchedOnlyMatched: watchedKeys.length,
      entries,
      watched: watchedKeys,
    };
  },
};
