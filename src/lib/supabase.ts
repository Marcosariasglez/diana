import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * A6: storageKey explícita para no compartir sesión con Norte si comparten
 * origen (GitHub Pages). Cambiarla desloguea a quien esté dentro.
 */
export const AUTH_STORAGE_KEY = 'vertice-diana-auth';

let client: SupabaseClient | null = null;

/** Cliente unico, creado la primera vez que se pide (en modo mock nunca se crea). */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('supabase-not-configured');
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      storageKey: AUTH_STORAGE_KEY,
      storage: AsyncStorage,
    },
  });
  return client;
}
