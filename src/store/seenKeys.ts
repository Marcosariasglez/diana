import type { HistoryEntry, InitialRating, MediaKey } from '@/types/rating';
import { buildMediaKey } from '@/utils/mediaKey';

/**
 * Vistos (6.1): union de entries, watched e initialRatings con valor like o skip.
 * `unseen` NO cuenta. Las claves de initialRatings son ids de peliculas -> "movie:<id>".
 */
export function buildSeenKeys(input: {
  initialRatings: Record<number, InitialRating>;
  entries: ReadonlyArray<Pick<HistoryEntry, 'key'>>;
  watched: ReadonlyArray<MediaKey>;
}): ReadonlySet<MediaKey> {
  const seen = new Set<MediaKey>();
  for (const idText of Object.keys(input.initialRatings)) {
    const id = Number(idText);
    const value = input.initialRatings[id];
    if (value === 'like' || value === 'skip') {
      seen.add(buildMediaKey({ mediaType: 'movie', mediaId: id }));
    }
  }
  for (const e of input.entries) seen.add(e.key);
  for (const k of input.watched) seen.add(k);
  return seen;
}
