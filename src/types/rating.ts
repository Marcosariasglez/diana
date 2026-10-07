export type Rating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface MediaRef {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  season?: number;
  episode?: number;
}

export type MediaKey = string;

export interface HistoryEntry {
  key: MediaKey;
  ref: MediaRef;
  title: string;
  posterColor: string;
  userRating: Rating;
  aiPrediction: number;
  predictionSeen: boolean;
  ratedAt: string;
  source: 'app' | 'letterboxd';
  genreIds?: number[];
}

export type EntryOrigin = 'detail' | 'daily-log';

export interface AddEntryInput {
  mediaRef: MediaRef;
  userRating: Rating;
  origin: EntryOrigin;
}

export type InitialRating = 'like' | 'skip' | 'unseen';

/** Perfil de gusto: peso por id de genero en puntos base [-10000, 10000]. */
export interface TasteProfile {
  userId: string;
  weightBp: Record<number, number>;
}

export interface RankingContext {
  userId: string;
  taste: TasteProfile;
  seenKeys: ReadonlySet<MediaKey>;
}