// Constantes compartidas por la suite E2E (usuarios ficticios, sin datos reales).

export const E2E_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'google-e2e@ejemplo.com',
  provider: 'google',
} as const;

/**
 * Genera un «JWT» sin firma con forma real (header.payload.) y exp en el futuro:
 * auth-js lo decodifica localmente para validar la caducidad al restaurar la sesión.
 */
export function makeJwt(sub: string, expOffsetSec = 3600): string {
  const b64url = (o: unknown): string =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    sub,
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
  });
  return `${header}.${payload}.`;
}

/** Usuario ficticio de email-OTP: el id se deriva del correo (determinista). */
export const emailUserId = (email: string): string => `22222222-0000-4000-8000-${email.length.toString().padStart(1, '0')}${(email.length * 7).toString(16).padStart(11, '0')}`;
