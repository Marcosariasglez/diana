// VERTICE-PLAN-2, D2-2: recomendador real (contenido) + interruptor.
//
// Dos modos:
//   - 'heuristic' (defecto): la heurística de géneros actual (mock-ai). Sin
//     servidor; se usa siempre que CATALOG=mock o BACKEND=mock.
//   - 'content': los RPC de la migración 0007 (`recommend` y `predict_tenths`,
//     ambos security invoker → el cliente solo ve lo suyo por RLS).
//
// `activeRecommender()` degrada a 'heuristic' cuando 'content' no tiene
// sentido (CATALOG=mock, BACKEND=mock, sin cliente Supabase). Así el cambio
// de variable nunca rompe la app: la heurística sigue siendo la red de
// seguridad.
import { CATALOG, RECOMMENDER } from '@/lib/env';
import type { Media, MediaType } from '@/types/media';
import { getSupabase } from '@/lib/supabase';
import { CATALOG as MOCK_CATALOG } from '@/mocks/data/catalog';

export type RecommenderKind = 'heuristic' | 'content';

export interface ContentRecommendation {
  media: Media;
  /** score en [-1, 1] (o 0 en frío: popularidad). */
  score: number;
  /** «Porque te gustó X» (hasta 2 títulos), vacío si no hay señal. */
  explanation: string[];
}

/** Modo efectivo: degrada a heuristic cuando 'content' no tiene sentido. */
export function activeRecommender(): RecommenderKind {
  if (RECOMMENDER !== 'content') return 'heuristic';
  if (CATALOG !== 'tmdb' || typeof process === 'undefined') return 'heuristic';
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
 * Si el título ya existe en el catálogo de mocks, devuelve ese Media completo
 * (modo de desarrollo: el build de pruebas no tiene 0006 desplegada).
 */
function mediaFromRpcRow(row: {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
}): Media | null {
  // Reutiliza el Media del catálogo mock si existe (ids 1-122 en desarrollo).
  const inMock = MOCK_CATALOG.find((m) => m.media_type === row.media_type && m.id === row.tmdb_id);
  if (inMock) return inMock;
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
    return { ...base, media_type: 'movie', title: row.title, release_date: '', runtime: 0 };
  }
  return { ...base, media_type: 'tv', name: row.title, first_air_date: '', episode_run_time: [], seasons: [] };
}
