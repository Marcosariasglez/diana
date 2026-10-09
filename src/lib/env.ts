export type BackendMode = 'mock' | 'supabase';
export type CatalogMode = 'mock' | 'tmdb';
/**
 * VERTICE-PLAN-2, D2-2.6: interruptor del recomendador.
 *   - 'heuristic' (defecto): la heurística de géneros actual (mock-ai), sin
 *     servidor.
 *   - 'content': recomendador basado en contenido (RPC `recommend` /
 *     `predict_tenths` de la migración 0007). Solo tiene sentido con
 *     CATALOG=tmdb (BACKEND=supabase); en cualquier otro caso el cliente
 *     degrada a 'heuristic' automáticamente (recommender.ts).
 * El valor por defecto se decide con la evaluación offline
 * (scripts/eval-recomendador.mjs → docs/vertice/plan2/evaluacion.md): si el
 * modelo contenido no gana a la heurística, se deja en 'heuristic'.
 */
export type RecommenderMode = 'heuristic' | 'content';

export const BACKEND: BackendMode = process.env.EXPO_PUBLIC_BACKEND === 'supabase' ? 'supabase' : 'mock';
export const CATALOG: CatalogMode = process.env.EXPO_PUBLIC_CATALOG === 'tmdb' ? 'tmdb' : 'mock';
export const RECOMMENDER: RecommenderMode = process.env.EXPO_PUBLIC_RECOMMENDER === 'content' ? 'content' : 'heuristic';
export const BASE_URL: string = process.env.EXPO_PUBLIC_BASE_URL ?? '';
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (CATALOG === 'tmdb' && BACKEND !== 'supabase') {
  throw new Error('EXPO_PUBLIC_CATALOG=tmdb exige EXPO_PUBLIC_BACKEND=supabase');
}
