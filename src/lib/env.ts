export type BackendMode = 'mock' | 'supabase';
export type CatalogMode = 'mock' | 'tmdb';

export const BACKEND: BackendMode = process.env.EXPO_PUBLIC_BACKEND === 'supabase' ? 'supabase' : 'mock';
export const CATALOG: CatalogMode = process.env.EXPO_PUBLIC_CATALOG === 'tmdb' ? 'tmdb' : 'mock';
export const BASE_URL: string = process.env.EXPO_PUBLIC_BASE_URL ?? '';
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (CATALOG === 'tmdb' && BACKEND !== 'supabase') {
  throw new Error('EXPO_PUBLIC_CATALOG=tmdb exige EXPO_PUBLIC_BACKEND=supabase');
}
