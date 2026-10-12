import type { MediaType } from '@/types/media';

export type SearchKind = 'all' | 'movie' | 'tv' | 'episode';

export interface SearchResult {
  kind: 'movie' | 'tv' | 'episode';
  label: 'Película' | 'Serie' | 'Capítulo';
  mediaId: number;
  mediaType: MediaType;
  title: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  posterColor: string;
}