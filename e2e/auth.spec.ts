/**
 * E2E · Flujos de acceso (VERTICE-NOCHE D-2, escenarios a, b y c).
 * La vuelta de Google llega con `?code=…&state=…` en la QUERY (no en el hash):
 * el mock responde /auth/v1/authorize con 302 a la redirect_to con el code, y
 * auth-js (detectSessionInUrl) canjea con POST /auth/v1/token?grant_type=pkce
 * usando el verifier que guardó en localStorage antes de navegar.
 */
import { test, expect } from '@playwright/test';
import { bootApp, expectInicio, expectLogin } from './helpers';
import { createState } from './supabaseMock';
import { E2E_USER } from './constants';

test.describe('acceso (supabase simulado)', () => {
  test('a) sin sesión → /login', async ({ page }) => {
    const { errors } = await bootApp(page);
    await page.goto('/');
    await expectLogin(page);
    expect(page.url()).toContain('/login');
    expectNoConsole(errors);
  });

  test('b) vuelta de Google con ?code=…&state=…: canje, limpia URL y no hay bucle', async ({ page }) => {
    const { s, errors } = await bootApp(page);
    await page.goto('/');
    await expectLogin(page);

    // La «ida a Google» navega a {SUPABASE}/authorize; el mock la responde
    // con 302 a redirect_to?code=…&state=… (así llega de verdad en web).
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    await expectInicio(page);

    // URL limpia: sin code/state (auth-js hace history.replaceState).
    const u = new URL(page.url());
    expect(u.searchParams.get('code')).toBeNull();
    expect(u.searchParams.get('state')).toBeNull();

    // Sesión persistida en la clave de Diana (no en la de Norte).
    const stored = await page.evaluate(() => window.localStorage.getItem('vertice-diana-auth'));
    expect(stored).toBeTruthy();
    const session = JSON.parse(stored ?? '{}');
    expect(session.user?.id).toBe(E2E_USER.id);
    expect(session.user?.app_metadata?.provider).toBe('google');
    // El canje usó grant pkce con auth_code y code_verifier.
    const tokenCall = s.log.find((l) => l.path.startsWith('/auth/v1/token') && l.query.includes('grant_type=pkce'));
    expect(tokenCall).toBeTruthy();
    const body = JSON.parse(tokenCall!.body);
    expect(body.auth_code).toBeTruthy();
    expect(body.code_verifier).toBeTruthy();
    // No hay bucle: la URL final es la app, no /login.
    expect(page.url()).not.toContain('/login');
    expectNoConsole(errors);
  });

  test('b2) Google + primer uso (sin onboarding) → bienvenida', async ({ page }) => {
    const s = createState();
    s.googleOnboarded = false;
    const { errors } = await bootApp(page, { state: s });
    await page.goto('/');
    await expectLogin(page);
    await page.getByRole('button', { name: 'Continuar con Google' }).click();
    await expect(page.getByRole('heading', { name: /Encuentra tu/ })).toBeVisible();
    expect(page.url()).toContain('/welcome');
    expectNoConsole(errors);
  });

  test('c) código por correo: enviar, error de código y código correcto', async ({ page }) => {
    const email = 'mail-e2e@ejemplo.com';
    const code = '482913';
    const s = createState();
    s.otpUser = { email, displayName: 'Mail E2E', hasOnboarded: true };
    s.otpCode = code;
    const { s: st, errors } = await bootApp(page, { state: s });
    await page.goto('/');
    await expectLogin(page);

    // Enviar
    await page.getByTestId('login-email-input').fill(email);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByTestId('login-code-input')).toBeVisible();
    const otpCall = st.log.find((l) => l.path === '/auth/v1/otp');
    expect(otpCall).toBeTruthy();
    expect(JSON.parse(otpCall!.body).email).toBe(email);

    // Código malo → error literal A4, sin salir de la pantalla
    await page.getByTestId('login-code-input').fill('000000');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-error')).toHaveText('Código incorrecto o caducado.');
    expect(page.url()).toContain('/login');

    // Código correcto → Inicio
    await page.getByTestId('login-code-input').fill(code);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expectInicio(page);
    expect(page.url()).not.toContain('/login');
    expectNoConsole(errors);
  });

  test('c2) código por correo + primer uso → bienvenida', async ({ page }) => {
    const email = 'nuevo-e2e@ejemplo.com';
    const code = '111222';
    const s = createState();
    s.otpUser = { email, displayName: 'Nuevo E2E', hasOnboarded: false };
    s.otpCode = code;
    await bootApp(page, { state: s });
    await page.goto('/');
    await expectLogin(page);
    await page.getByTestId('login-email-input').fill(email);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await page.getByTestId('login-code-input').fill(code);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: /Encuentra tu/ })).toBeVisible();
    expect(page.url()).toContain('/welcome');
  });

  test('c3) envío con 429 → «Demasiados intentos. Espera unos minutos.»', async ({ page }) => {
    const s = createState();
    s.otpUser = { email: 'x@ejemplo.com', displayName: 'X', hasOnboarded: true };
    s.otpSendFail = true;
    await bootApp(page, { state: s });
    await page.goto('/');
    await expectLogin(page);
    await page.getByTestId('login-email-input').fill('x@ejemplo.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByTestId('login-error')).toHaveText('Demasiados intentos. Espera unos minutos.');
  });
});

function expectNoConsole(errors: string[]): void {
  expect(errors, `Errores de consola:\n${errors.join('\n')}`).toEqual([]);
}
