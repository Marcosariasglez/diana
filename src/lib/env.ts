/**
 * VERTICE-PLAN-2, D2-2.6 / F4-3: interruptor del recomendador + config Supabase.
 *
 * BACKEND y CATALOG eliminados (P10): la app siempre usa Supabase + TMDB.
 * Si faltan las credenciales de Supabase, la app lanza al importar.
 *
 *   - 'content' (defecto): recomendador basado en contenido (RPC `recommend` /
 *     `predict_tenths`, migración 0007).
 *   - 'heuristic' (opt-out EXPO_PUBLIC_RECOMMENDER=heuristic): heurística de
 *     géneros, sin servidor. Red de seguridad.
 */
export type RecommenderMode = 'heuristic' | 'content';

export const RECOMMENDER: RecommenderMode = process.env.EXPO_PUBLIC_RECOMMENDER === 'heuristic' ? 'heuristic' : 'content';
export const BASE_URL: string = process.env.EXPO_PUBLIC_BASE_URL ?? '';
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Diana necesita Supabase: EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY son obligatorios');
}
