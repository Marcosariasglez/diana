export type BackendMode = 'mock' | 'supabase';
export type CatalogMode = 'mock' | 'tmdb';
/**
 * VERTICE-PLAN-2, D2-2.6: interruptor del recomendador.
 *   - 'content' (defecto desde A.6): recomendador basado en contenido (RPC
 *     `recommend` / `predict_tenths` de la migración 0007). Solo tiene
 *     sentido con CATALOG=tmdb (BACKEND=supabase); en cualquier otro caso
 *     el cliente degrada a 'heuristic' automáticamente (activeRecommender).
 *   - 'heuristic' (opt-out explícito EXPO_PUBLIC_RECOMMENDER=heuristic): la
 *     heurística de géneros actual (mock-ai), sin servidor.
 * El defecto 'content' viene de la evaluación real (fase A.6):
 * scripts/eval-dump.mjs + scripts/eval-recomendador.mjs --real →
 * docs/vertice/plan2/evaluacion.md (content gana a la heurística en EAM y
 * p@10). La heurística sigue siendo la red de seguridad: en modo mock o
 * sin features el cliente degrada sin que el usuario lo note.
 */
export type RecommenderMode = 'heuristic' | 'content';

export const BACKEND: BackendMode = process.env.EXPO_PUBLIC_BACKEND === 'supabase' ? 'supabase' : 'mock';
export const CATALOG: CatalogMode = process.env.EXPO_PUBLIC_CATALOG === 'tmdb' ? 'tmdb' : 'mock';
export const RECOMMENDER: RecommenderMode = process.env.EXPO_PUBLIC_RECOMMENDER === 'heuristic' ? 'heuristic' : 'content';
export const BASE_URL: string = process.env.EXPO_PUBLIC_BASE_URL ?? '';
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (CATALOG === 'tmdb' && BACKEND !== 'supabase') {
  throw new Error('EXPO_PUBLIC_CATALOG=tmdb exige EXPO_PUBLIC_BACKEND=supabase');
}
