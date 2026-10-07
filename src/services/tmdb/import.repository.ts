import type { ImportResult } from '@/types/import';
import type { HistoryEntry, MediaKey } from '@/types/rating';
import { genreLookup, registerGenres } from '@/lib/genreIndex';
import { predictTenths } from '@/mocks/mock-ai/predict';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { buildMediaKey } from '@/utils/mediaKey';
import { posterColor } from '@/utils/posterColor';
import { ImportError, parseRating, ratedAtOf, readFile, type ImportRepository, type Report } from '../import.repository';
import { invokeTmdb } from './invoke';

const BATCH = 40;

interface MatchRow {
  i: number;
  id: number | null;
  title?: string;
  genre_ids?: number[];
}

export const tmdbImportRepository: ImportRepository = {
  async parseLetterboxd(file, opts) {
    const onProgress = opts?.onProgress;
    const report: Report = (phase, processed = 0, total = 0) => onProgress?.({ phase, processed, total });

    const { ratings, watched } = await readFile(file, report);
    const ratingRows = ratings?.rows ?? [];
    const watchedRows = watched?.rows ?? [];
    const all = [
      ...ratingRows.map((row) => ({ row, kind: 'rating' as const })),
      ...watchedRows.map((row) => ({ row, kind: 'watched' as const })),
    ];
    const total = all.length;

    // Perfil previo a la importacion (misma regla que addEntry).
    const { profile } = useProfileStore.getState();
    const history = useHistoryStore.getState();
    const existingKeys = new Set<MediaKey>(history.entries.map((e) => e.key));
    const existingWatched = new Set<MediaKey>(history.watched);
    const taste = buildTasteProfile(profile.id, profile.initialRatings, history.entries);

    const entries: HistoryEntry[] = [];
    const newKeys = new Set<MediaKey>();
    const watchedKeys: MediaKey[] = [];
    const watchedSeen = new Set<MediaKey>();
    let unmatched = 0;
    let alreadyPresent = 0;
    let processed = 0;

    report('matching', 0, total);
    for (let start = 0; start < total; start += BATCH) {
      const batch = all.slice(start, start + BATCH);
      const items = batch.map(({ row }) => ({ name: row.Name ?? '', year: Number(row.Year) || 0 }));
      let matches: MatchRow[];
      try {
        matches = await invokeTmdb<MatchRow[]>({ action: 'match', items });
      } catch {
        throw new ImportError('read-failed');
      }
      const byIndex = new Map(matches.map((m) => [m.i, m]));
      batch.forEach(({ row, kind }, i) => {
        const m = byIndex.get(i);
        const rating = kind === 'rating' ? parseRating(row.Rating) : null;
        if (!m || m.id === null || (kind === 'rating' && rating === null)) {
          if (kind === 'rating') unmatched++;
          return;
        }
        const key = buildMediaKey({ mediaType: 'movie', mediaId: m.id });
        registerGenres(key, m.genre_ids ?? []);
        if (kind === 'rating' && rating !== null) {
          if (existingKeys.has(key) || newKeys.has(key)) {
            alreadyPresent++;
            return;
          }
          newKeys.add(key);
          const pseudo = genreLookup('movie', m.id);
          entries.push({
            key,
            ref: { mediaType: 'movie', mediaId: m.id },
            title: m.title ?? row.Name ?? '',
            posterColor: posterColor(m.id),
            userRating: rating,
            aiPrediction: pseudo ? predictTenths(taste, pseudo, key) / 10 : 3,
            predictionSeen: false,
            ratedAt: ratedAtOf(row.Date),
            source: 'letterboxd',
            genreIds: m.genre_ids ?? [],
          });
        } else if (!existingKeys.has(key) && !newKeys.has(key) && !watchedSeen.has(key)) {
          watchedSeen.add(key);
          if (!existingWatched.has(key)) watchedKeys.push(key);
        }
      });
      processed += batch.length;
      report('matching', processed, total);
    }

    if (entries.length === 0 && watchedKeys.length === 0) throw new ImportError('no-matches');
    report('done', total, total);
    const result: ImportResult = {
      totalRows: entries.length + unmatched + alreadyPresent,
      matched: entries.length,
      unmatched,
      alreadyPresent,
      watchedOnlyMatched: watchedKeys.length,
      entries,
      watched: watchedKeys,
    };
    return result;
  },
};
