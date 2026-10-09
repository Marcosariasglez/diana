/**
 * E2E · No mezcla con Norte (VERTICE-NOCHE D-2, escenario i).
 * Con una sesión de la OTRA app (clave vertice-norte-auth) presente en el
 * mismo localStorage (mismo origen en GitHub Pages), Diana debe:
 *  1. No arrancar «dentro» usando esa sesión (ir a /login).
 *  2. No borrarla ni tocarla al cerrar sesión.
 */
import { test, expect } from '@playwright/test';
import { bootApp, expectLogin } from './helpers';
import { createState, seedGoogleSession } from './supabaseMock';
import { E2E_USER } from './constants';

const NORTHE_AUTH_KEY = 'vertice-norte-auth';
const DIANA_AUTH_KEY = 'vertice-diana-auth';

test.describe('no mezcla con Norte (mismo origen)', () => {
  test('i1) sesión de Norte presente → Diana va a /login y no la usa', async ({ page }) => {
    const norteSession = {
      access_token: 'eyJhbGciOiJub25lIn0.norte-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'e2e-norte-refresh',
      scope: 'email',
      user: { id: '99999999-9999-4999-8999-999999999999', email: 'norte@ejemplo.com', app_metadata: { provider: 'google' } },
    };
    const { errors } = await bootApp(page, {
      extraStorage: { [NORTHE_AUTH_KEY]: JSON.stringify(norteSession) },
    });
    await page.goto('/');
    // Diana NO se loguea con la sesión de Norte: pide acceso.
    await expectLogin(page);
    expect(page.url()).toContain('/login');
    // La sesión de Diana no ha sido creada con datos ajenos.
    const diana = await page.evaluate((k) => window.localStorage.getItem(k), DIANA_AUTH_KEY);
    if (diana) expect(JSON.parse(diana).user?.id).not.toBe(norteSession.user.id);
    // La sesión de Norte sigue intacta.
    const norte = await page.evaluate((k) => window.localStorage.getItem(k), NORTHE_AUTH_KEY);
    expect(JSON.parse(norte ?? '{}').user?.id).toBe(norteSession.user.id);
    expectNoConsole(errors);
  });

  test('i2) cerrar sesión en Diana NO borra la sesión de Norte', async ({ page }) => {
    const norteSession = {
      access_token: 'eyJhbGciOiJub25lIn0.norte-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'e2e-norte-refresh',
      scope: 'email',
      user: { id: '99999999-9999-4999-8999-999999999999', email: 'norte@ejemplo.com', app_metadata: { provider: 'google' } },
    };
    const s = createState();
    await bootApp(page, {
      state: s,
      signedIn: true,
      extraStorage: { [NORTHE_AUTH_KEY]: JSON.stringify(norteSession) },
    });
    // Saneidad: la app sí usa SU sesión (vertice-diana-auth), no la de Norte.
    const diana = await page.evaluate((k) => window.localStorage.getItem(k), DIANA_AUTH_KEY);
    expect(JSON.parse(diana ?? '{}').user?.id).toBe(E2E_USER.id);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Para ti' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Perfil', exact: true }).click();
    await page.getByRole('button', { name: 'Gestionar cuenta' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expectLogin(page);

    // Norte intacta, Diana borrada.
    const norte = await page.evaluate((k) => window.localStorage.getItem(k), NORTHE_AUTH_KEY);
    expect(JSON.parse(norte ?? '{}').user?.id).toBe(norteSession.user.id);
    const dianaAfter = await page.evaluate((k) => window.localStorage.getItem(k), DIANA_AUTH_KEY);
    expect(dianaAfter).toBeNull();
  });
});

function expectNoConsole(errors: string[]): void {
  expect(errors, `Errores de consola:\n${errors.join('\n')}`).toEqual([]);
}

void seedGoogleSession; // (usado internamente por bootApp con signedIn)
