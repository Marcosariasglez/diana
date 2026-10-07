import { getSupabase } from '@/lib/supabase';

export async function invokeTmdb<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('tmdb', { body });
  if (error) throw error;
  return data as T;
}
