import type { HistoryEntry, Rating } from '@/types/rating';
import { posterColor } from '@/utils/posterColor';

export interface HistoryRow {
  user_id: string; key: string; media_type: 'movie' | 'tv'; media_id: number;
  season: number | null; episode: number | null; title: string; genre_ids: number[];
  user_rating: number; ai_prediction_tenths: number; prediction_seen: boolean;
  source: 'app' | 'letterboxd'; rated_at: string;
}

export function rowToEntry(r: HistoryRow): HistoryEntry {
  return {
    key: r.key,
    ref: {
      mediaType: r.media_type,
      mediaId: r.media_id,
      ...(r.season !== null ? { season: r.season } : {}),
      ...(r.episode !== null ? { episode: r.episode } : {}),
    },
    title: r.title,
    posterColor: posterColor(r.media_id),
    userRating: Number(r.user_rating) as Rating,
    aiPrediction: r.ai_prediction_tenths / 10,
    predictionSeen: r.prediction_seen,
    ratedAt: r.rated_at,
    source: r.source,
    genreIds: r.genre_ids,
  };
}

export function entryToRow(userId: string, e: HistoryEntry): HistoryRow {
  return {
    user_id: userId, key: e.key, media_type: e.ref.mediaType, media_id: e.ref.mediaId,
    season: e.ref.season ?? null, episode: e.ref.episode ?? null, title: e.title,
    genre_ids: e.genreIds ?? [], user_rating: e.userRating,
    ai_prediction_tenths: Math.round(e.aiPrediction * 10), prediction_seen: e.predictionSeen,
    source: e.source, rated_at: e.ratedAt,
  };
}
