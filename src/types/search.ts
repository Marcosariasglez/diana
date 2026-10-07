export type SearchKind = 'all' | 'movie' | 'tv' | 'episode';

export interface SearchResult {
  kind: 'movie' | 'tv' | 'episode';
  label: 'Película' | 'Serie' | 'Capítulo';
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  posterColor: string;
}