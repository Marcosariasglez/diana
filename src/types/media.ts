export type MediaType = 'movie' | 'tv';

export interface Genre {
  id: number;
  name: string;
}

interface MediaBase {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Genre[];
  overview: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  platforms: string[];
  alt_titles: string[];
}

export interface Movie extends MediaBase {
  media_type: 'movie';
  title: string;
  release_date: string;
  runtime: number;
}

export interface TVEpisode {
  episode_number: number;
  name: string;
  runtime: number;
  still_path: string | null;
}

export interface TVSeason {
  season_number: number;
  episode_count: number;
  episodes: TVEpisode[];
}

export interface TVSeries extends MediaBase {
  media_type: 'tv';
  name: string;
  first_air_date: string;
  episode_run_time: number[];
  seasons: TVSeason[];
}

export type Media = Movie | TVSeries;

export type AffinityBucket = 'alto' | 'medio' | 'bajo';

export interface MediaWithAffinity {
  media: Media;
  bucket: AffinityBucket;
}

export interface FeedCategory {
  id: 'hidden-gems' | 'recommendations';
  title: string;
  media: MediaWithAffinity[];
  hasSeeAll: boolean;
}