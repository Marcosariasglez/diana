import type { Href } from 'expo-router';
import type { HistoryEntry } from '@/types/rating';
import type { ImportPhase, ImportResult } from '@/types/import';

export const HISTORY_PAGE_SIZE = 50;

export const IMPORT_PHASE_LABELS: Record<ImportPhase, string> = {
  reading: 'Leyendo archivo',
  unzipping: 'Descomprimiendo',
  parsing: 'Leyendo valoraciones',
  matching: 'Buscando coincidencias',
  done: 'Buscando coincidencias',
};

/** Copia ordenada por ratedAt descendente (estable ante empates). */
export function sortHistory(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return entries
    .map((e, i) => ({ e, i, t: Date.parse(e.ratedAt) || 0 }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((x) => x.e);
}

export interface HistoryPage {
  visible: HistoryEntry[];
  hasMore: boolean;
}

/** Primeras `pages * 50` entradas ordenadas y si quedan mas. */
export function paginateHistory(entries: readonly HistoryEntry[], pages: number): HistoryPage {
  const sorted = sortHistory(entries);
  const count = Math.max(1, pages) * HISTORY_PAGE_SIZE;
  return { visible: sorted.slice(0, count), hasMore: sorted.length > count };
}

/** "Importadas N valoraciones. M sin coincidencia." (+ " K ya estaban en tu historial."). */
export function importSummary(r: ImportResult): string {
  const base = `Importadas ${r.matched} ${r.matched === 1 ? 'valoración' : 'valoraciones'}. ${r.unmatched} sin coincidencia.`;
  return r.alreadyPresent > 0 ? `${base} ${r.alreadyPresent} ya estaban en tu historial.` : base;
}

/** Ruta de la Ficha para una entrada del historial. */
export function detailHref(entry: HistoryEntry): Href {
  const { mediaType, mediaId, season, episode } = entry.ref;
  const params: Record<string, string> = { id: String(mediaId), type: mediaType };
  if (season !== undefined) params.season = String(season);
  if (season !== undefined && episode !== undefined) params.episode = String(episode);
  return { pathname: '/detail/[id]', params } as Href;
}
