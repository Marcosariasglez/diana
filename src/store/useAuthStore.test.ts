const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockGetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: jest.fn(),
      signInWithOtp: () => mockSignInWithOtp(),
      verifyOtp: () => mockVerifyOtp(),
      signInWithOAuth: () => mockSignInWithOAuth(),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

jest.mock('./bootstrapUserData', () => ({
  bootstrapUserData: jest.fn().mockResolvedValue(undefined),
  resetLocalStores: jest.fn(),
}));

import { useAuthStore } from './useAuthStore';
import { AUTH_MESSAGES } from '@/constants/authMessages';

describe('useAuthStore (A4/D3)', () => {
  beforeEach(() => {
    mockSignInWithOtp.mockReset().mockResolvedValue({ error: null });
    mockVerifyOtp.mockReset().mockResolvedValue({ error: null });
    mockSignOut.mockReset().mockResolvedValue({ error: null });
    mockSignInWithOAuth.mockReset().mockResolvedValue({ error: null });
    mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
    useAuthStore.setState({ error: null, status: 'signedOut', userId: null, email: null, provider: null });
  });

  it('sendEmailCode: error de envío → código otp_send_failed', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Could not send verification email' } });
    const ok = await useAuthStore.getState().sendEmailCode('ana@vertice.app');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('otp_send_failed');
  });

  it('sendEmailCode: tope de usuarios → max_users', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'User limit reached' } });
    await useAuthStore.getState().sendEmailCode('ana@vertice.app');
    expect(useAuthStore.getState().error).toBe('max_users');
  });

  it('sendEmailCode: 429 → rate_limited', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Too Many Requests. Try again in 1 min.', status: 429 } });
    await useAuthStore.getState().sendEmailCode('ana@vertice.app');
    expect(useAuthStore.getState().error).toBe('rate_limited');
  });

  it('sendEmailCode: fetch fallido → network', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'fetch failed' } });
    await useAuthStore.getState().sendEmailCode('ana@vertice.app');
    expect(useAuthStore.getState().error).toBe('network');
  });

  it('verifyEmailCode: código malo → otp_invalid', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const ok = await useAuthStore.getState().verifyEmailCode('ana@vertice.app', '000000');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('otp_invalid');
  });

  it('signInWithGoogle: fallo → google_failed', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'provider error' } });
    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().error).toBe('google_failed');
  });

  it('signInWithGoogle: sin error → error null', async () => {
    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('signOut: limpia estado local y llama a resetLocalStores', async () => {
    const { resetLocalStores } = require('./bootstrapUserData');
    await useAuthStore.getState().signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(resetLocalStores).toHaveBeenCalled();
    const s = useAuthStore.getState();
    expect(s.status).toBe('signedOut');
    expect(s.userId).toBeNull();
    expect(s.email).toBeNull();
  });

  it('signOutEverywhere: scope global', async () => {
    await useAuthStore.getState().signOutEverywhere();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('los códigos se traducen a los textos literales de A4', () => {
    expect(AUTH_MESSAGES.otp_invalid).toBe('Código incorrecto o caducado.');
    expect(AUTH_MESSAGES.google_failed).toBe('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    expect(AUTH_MESSAGES.otp_send_failed).toBe('No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.');
    expect(AUTH_MESSAGES.rate_limited).toBe('Demasiados intentos. Espera unos minutos.');
    expect(AUTH_MESSAGES.network).toBe('Sin conexión. Inténtalo de nuevo.');
    expect(AUTH_MESSAGES.max_users).toBe('La app ha alcanzado su número máximo de usuarios.');
    expect(AUTH_MESSAGES.account_locked).toBe('Esta cuenta está bloqueada.');
  });
});
