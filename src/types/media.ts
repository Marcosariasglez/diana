export type MediaType = 'movie' | 'tv' | 'short' | 'documentary';

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
  /** A.7: explicación del recomendador «content» (RPC recommend: «Porque te
   *  gustó X»). Solo la pinta la tarjeta destacada; vacío en la heurística. */
  explanation?: string[];
}

export interface FeedCategory {
  id: 'hidden-gems' | 'recommendations';
  title: string;
  media: MediaWithAffinity[];
  hasSeeAll: boolean;
}

// --- P6: tipos del feed rediseñado ---

/** Razón de recomendación (expuesta al usuario, nunca nota numérica). */
export type ReasonKind = 'liked' | 'genre' | 'era';

export interface Reason {
  kind: ReasonKind;
  /** Texto visible: «Porque te gustó X», «Porque te gusta el drama», «Porque buscas cine de los 90». */
  text: string;
}

/** Ítem de feed: MediaWithAffinity extendido con razón. */
export interface FeedItem extends MediaWithAffinity {
  reason?: Reason;
}

/** Fila del feed de Inicio: título + ítems + razón opcional + enlace «Ver todo». */
export interface FeedRow {
  /** Id único: puede ser string libre como 'genre-18', 'decade-1990', 'liked-movie-496243', 'popular', 'top-rated'. */
  id: string;
  /** Título de sección: «Joyas ocultas», «Porque te gustó Sicario», etc. */
  title: string;
  /** Subtítulo de razón: «Basado en tus valoraciones de thriller» (vacío si no aplica). */
  subtitle?: string;
  items: FeedItem[];
  /** Categoría de see-all (null si no hay «Ver todo»). */
  seeAll?: string | null;
}