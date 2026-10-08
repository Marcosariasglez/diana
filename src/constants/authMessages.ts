/**
 * Textos de error de autenticación — A4 literales.
 * El store devuelve códigos; la pantalla traduce.
 */

export type AuthErrorCode =
  | 'google_failed'
  | 'otp_send_failed'
  | 'otp_invalid'
  | 'max_users'
  | 'account_locked'
  | 'rate_limited'
  | 'network';

export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  google_failed: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.',
  otp_send_failed: 'No pudimos enviar el código. Revisa el correo e inténtalo de nuevo.',
  otp_invalid: 'Código incorrecto o caducado.',
  max_users: 'La app ha alcanzado su número máximo de usuarios.',
  account_locked: 'Esta cuenta está bloqueada.',
  rate_limited: 'Demasiados intentos. Espera unos minutos.',
  network: 'Sin conexión. Inténtalo de nuevo.',
};
