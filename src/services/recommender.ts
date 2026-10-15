// VERTICE-PLAN-2, D2-2 / F4-3: recomendador real (contenido) + interruptor.
//
// Dos modos:
//   - 'content' (defecto): recomendador basado en contenido (RPC `recommend` /
//     `predict_tenths` de la migración 0007).
//   - 'heuristic': heurística de géneros, sin servidor. Red de seguridad.
//
// `activeRecommender()` degrada a 'heuristic' cuando RECOMMENDER !== 'content'
// o en tests sin proceso (Jest). La degradación por fallo del RPC la hacen
// `contentRecommend`/`contentPredictTenths`, que devuelven `null`.
import { RECOMMENDER } from '@/lib/env';
import type { Media, MediaType } from '@/types/media';
import { getSupabase } from '@/lib/supabase';

export type RecommenderKind = 'heuristic' | 'content';

export interface ContentRecommendation {
  media: Media;
  /** score en [-1, 1] (o 0 en frío: popularidad). */
  score: number;
  /** «Porque te gustó X» (hasta 2 títulos), vacío si no hay señal. */
  explanation: string[];
}

/** Modo efectivo: degrada a heuristic cuando RECOMMENDER !== 'content'. */
export function activeRecommender(): RecommenderKind {
  if (RECOMMENDER !== 'content') return 'heuristic';
  return 'content';
}

export interface RecommendParams {
  platforms: ReadonlyArray<string>;
  /** nº de candidatos (el servidor ordena por afinidad y recorta). */
  limit?: number;
  type?: MediaType;
}

/**
 * Candidatos ordenados por afinidad del usuario, dentro de sus plataformas,
 * excluyendo vistos/valorados (el RPC ya lo hace por RLS del usuario).
 * `content` → RPC `recommend`; si falla (sin sesión, sin 0007 desplegada…)
 * devuelve `null` para que el caller decaiga a la heurística.
 */
export async function contentRecommend(params: RecommendParams): Promise<ContentRecommendation[] | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('recommend', {
      p_platforms: [...params.platforms],
      p_limit: params.limit ?? 50,
      p_offset: 0,
      p_types: params.type ? [params.type] : null,
    });
    if (error) return null;
    const rows = (data ?? []) as Array<{
      media_type: MediaType;
      tmdb_id: number;
      title: string;
      original_title?: string;
      poster_path: string | null;
      score: number | string;
      explanation: string[];
    }>;
    if (!Array.isArray(rows)) return null;
    const out: ContentRecommendation[] = [];
    for (const r of rows) {
      const media = mediaFromRpcRow(r);
      if (!media) continue;
      out.push({
        media,
        score: typeof r.score === 'string' ? Number(r.score) : r.score,
        explanation: Array.isArray(r.explanation) ? r.explanation : [],
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Nota IA calibrada en décimas 10..50 para un título (mismo contrato que
 * predictTenths). `content` → RPC `predict_tenths`; `null` si falla.
 */
export async function contentPredictTenths(type: MediaType, tmdbId: number): Promise<number | null> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('predict_tenths', {
      p_media_type: type,
      p_tmdb_id: tmdbId,
    });
    if (error || data == null) return null;
    const t = typeof data === 'string' ? Number(data) : (data as unknown as number);
    if (!Number.isFinite(t) || t < 10 || t > 50) return null;
    return Math.round(t);
  } catch {
    return null;
  }
}

/**
 * Fila del RPC → Media (mínimo para el feed). La ficha completa ya existe en
 * `catalog_repository.getMediaById`; aquí solo hace falta lo suficiente para
 * pintar el carril (poster, géneros vacíos, plataformas desconocidas → []).
 * F2-1: el mapeo es 1:1 desde la fila del servidor — NUNCA se sustituye ni se
 * complementa con datos del catálogo mock (el id del mock es un espacio distinto
 * al de TMDB y «enriquecía» títulos reales con datos inventados).
 */
function mediaFromRpcRow(row: {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  original_title?: string;
  poster_path: string | null;
}): Media | null {
  // Fallback: title puede estar vacío cuando sync solo guardó original_title.
  const resolvedTitle = row.title || row.original_title || '';
  // Sin título no se pinta: saldría «Película 9772» y su ficha no existiría.
  if (!resolvedTitle) return null;
  const base = {
    id: row.tmdb_id,
    poster_path: row.poster_path,
    backdrop_path: null as string | null,
    genres: [] as { id: number; name: string }[],
    overview: '',
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    platforms: [] as string[],
    alt_titles: [] as string[],
  };
  if (row.media_type === 'movie') {
    return { ...base, media_type: 'movie', title: resolvedTitle, release_date: '', runtime: 0 };
  }
  return { ...base, media_type: 'tv', name: resolvedTitle, first_air_date: '', episode_run_time: [], seasons: [] };
}
