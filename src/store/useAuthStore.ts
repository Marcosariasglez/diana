import { create } from 'zustand';
import { Platform } from 'react-native';
import type { AuthError, Session } from '@supabase/supabase-js';
import { BACKEND, BASE_URL } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import type { AuthErrorCode } from '@/constants/authMessages';
import { bootstrapUserData, resetLocalStores } from './bootstrapUserData';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type AuthProvider = 'google' | 'email' | null;

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  provider: AuthProvider;
  /** Código de error A4 (la pantalla lo traduce con AUTH_MESSAGES). */
  error: AuthErrorCode | null;
  init: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Cierra sesión en todos los dispositivos (scope global). */
  signOutEverywhere: () => Promise<void>;
  clearError: () => void;
}

let started = false;

const isNetworkError = (e: AuthError): boolean =>
  /fetch failed|network|timeout|timeouterror|ECONN/i.test(e.message ?? '');

const otpErrorCode = (e: AuthError): AuthErrorCode => {
  const msg = (e.message ?? '').toLowerCase();
  if (isNetworkError(e)) return 'network';
  if (e.status === 429 || msg.includes('rate') || msg.includes('too many')) return 'rate_limited';
  if (msg.includes('max users') || msg.includes('user limit')) return 'max_users';
  if (msg.includes('banned') || msg.includes('blocked')) return 'account_locked';
  return 'otp_send_failed';
};

const otpVerifyErrorCode = (e: AuthError): AuthErrorCode => {
  const msg = (e.message ?? '').toLowerCase();
  if (isNetworkError(e)) return 'network';
  if (msg.includes('banned') || msg.includes('blocked')) return 'account_locked';
  return 'otp_invalid';
};

export const useAuthStore = create<AuthState>()((set, get) => {
  const handleSession = async (session: Session | null) => {
    if (!session) {
      resetLocalStores();
      set({ status: 'signedOut', userId: null, email: null, provider: null });
      return;
    }
    if (get().status === 'signedIn' && get().userId === session.user.id) return;
    set({ status: 'loading' });
    try {
      await bootstrapUserData(session.user.id);
    } catch {
      // La copia local sigue sirviendo; se avisa de forma no bloqueante.
    }
    set({
      status: 'signedIn',
      userId: session.user.id,
      email: session.user.email ?? null,
      provider: (session.user.app_metadata?.provider as AuthProvider) ?? 'email',
    });
  };

  return {
    status: BACKEND === 'supabase' ? 'loading' : 'signedIn',
    userId: null,
    email: null,
    provider: null,
    error: null,
    clearError: () => set({ error: null }),
    init: async () => {
      if (started || BACKEND !== 'supabase') return;
      started = true;
      const sb = getSupabase();
      sb.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => void handleSession(session), 0);
      });
      const { data } = await sb.auth.getSession();
      if (!data.session && get().status === 'loading') {
        set({ status: 'signedOut', provider: null });
      }
    },
    signInWithGoogle: async () => {
      set({ error: null });
      const redirectTo =
        Platform.OS === 'web' ? `${window.location.origin}${BASE_URL}/` : undefined;
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) set({ error: isNetworkError(error) ? 'network' : 'google_failed' });
    },
    sendEmailCode: async (email) => {
      set({ error: null });
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        set({ error: otpErrorCode(error) });
        return false;
      }
      return true;
    },
    verifyEmailCode: async (email, code) => {
      set({ error: null });
      const { error } = await getSupabase().auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (error) {
        set({ error: otpVerifyErrorCode(error) });
        return false;
      }
      return true;
    },
    signOut: async () => {
      await getSupabase().auth.signOut().catch(() => undefined);
      resetLocalStores();
      set({ status: 'signedOut', userId: null, email: null, provider: null, error: null });
    },
    signOutEverywhere: async () => {
      await getSupabase()
        .auth.signOut({ scope: 'global' })
        .catch(() => undefined);
      resetLocalStores();
      set({ status: 'signedOut', userId: null, email: null, provider: null, error: null });
    },
  };
});
