import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { BACKEND, BASE_URL } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { bootstrapUserData, resetLocalStores } from './bootstrapUserData';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  error: string | null;
  init: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

let started = false;

export const useAuthStore = create<AuthState>()((set, get) => {
  const handleSession = async (session: Session | null) => {
    if (!session) {
      resetLocalStores();
      set({ status: 'signedOut', userId: null, email: null });
      return;
    }
    if (get().status === 'signedIn' && get().userId === session.user.id) return;
    set({ status: 'loading' });
    try {
      await bootstrapUserData(session.user.id);
      set({ error: null });
    } catch {
      set({ error: 'No se pudieron cargar tus datos. Se usa la copia local.' });
    }
    set({ status: 'signedIn', userId: session.user.id, email: session.user.email ?? null });
  };

  return {
    status: BACKEND === 'supabase' ? 'loading' : 'signedIn',
    userId: null,
    email: null,
    error: null,
    init: async () => {
      if (started || BACKEND !== 'supabase') return;
      started = true;
      const sb = getSupabase();
      sb.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => void handleSession(session), 0);
      });
      const { data } = await sb.auth.getSession();
      if (!data.session && get().status === 'loading') set({ status: 'signedOut' });
    },
    signInWithGoogle: async () => {
      set({ error: null });
      const redirectTo = Platform.OS === 'web' ? `${window.location.origin}${BASE_URL}/` : undefined;
      const { error } = await getSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) set({ error: 'No se pudo iniciar sesi\u00f3n con Google. Int\u00e9ntalo de nuevo.' });
    },
    sendEmailCode: async (email) => {
      set({ error: null });
      const { error } = await getSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) set({ error: 'No pudimos enviar el c\u00f3digo. Revisa el correo e int\u00e9ntalo de nuevo.' });
      return !error;
    },
    verifyEmailCode: async (email, code) => {
      set({ error: null });
      const { error } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) set({ error: 'C\u00f3digo incorrecto o caducado.' });
      return !error;
    },
    signOut: async () => {
      await getSupabase().auth.signOut();
      set({ status: 'signedOut', userId: null, email: null });
    },
  };
});
