import type { HistoryEntry, MediaKey } from './rating';

export type ImportPhase = 'reading' | 'unzipping' | 'parsing' | 'matching' | 'done';

export interface ImportProgress {
  phase: ImportPhase;
  processed: number;
  total: number;
}

export type ImportErrorCode =
  | 'unsupported-type'
  | 'too-large'
  | 'empty'
  | 'zip-without-data'
  | 'missing-columns'
  | 'read-failed'
  | 'no-matches';

export interface ImportResult {
  totalRows: number;
  matched: number;
  unmatched: number;
  alreadyPresent: number;
  watchedOnlyMatched: number;
  entries: HistoryEntry[];
  watched: MediaKey[];
}