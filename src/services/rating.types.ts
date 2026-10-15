// P9 (F4-2): tipos extraídos del repositorio mock rating.repository.ts
// antes de borrarlo.
import type { AddEntryInput, HistoryEntry, MediaKey, MediaRef } from '@/types/rating';

export interface RatingRepository {
  saveRating(input: AddEntryInput): Promise<HistoryEntry>;
  getRating(key: MediaKey): Promise<HistoryEntry | null>;
  getAllRatings(): Promise<HistoryEntry[]>;
}

/** Titulo desnormalizado: "Fallout", "Fallout T1", "Fallout T1 · E3". */
export function entryTitle(ref: MediaRef, baseTitle: string): string {
  if (ref.season === undefined) return baseTitle;
  const season = `${baseTitle} T${ref.season}`;
  return ref.episode === undefined ? season : `${season} · E${ref.episode}`;
}
