/**
 * E2E · Cuenta (VERTICE-NOCHE D-2, escenarios d, e, f, g, h).
 * Todo contra el mock de Supabase: los asserts verifican qué pide la app
 * (scopes de /logout, cuerpo de /functions/v1/delete-account, descarga JSON)
 * y qué limpia en localStorage (claves diana.* y vertice-diana-auth).
 */
import { test, expect } from '@playwright/test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootApp, expectInicio, expectLogin, goAccount } from './helpers';
import { createState } from './supabaseMock';
import { E2E_USER } from './constants';

const NORTHE_AUTH_KEY = 'vertice-norte-auth';
const DIANA_AUTH_KEY = 'vertice-diana-auth';

async function signedInPage(page: Parameters<typeof bootApp>[0], s = createState()): Promise<ReturnType<typeof bootApp>> {
  const r = await bootApp(page, { state: s, signedIn: true });
  await page.goto('/');
  await expectInicio(page);
  return r;
}

test.describe('cuenta (supabase simulado)', () => {
  test('d) cerrar sesión: scope local, limpia diana.* y vertice-diana-auth, vuelve a /login', async ({ page }) => {
    const { s, errors } = await signedInPage(page);
    // Dato local que debe desaparecer con el cierre.
    await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
    // (la métrica de vistas persiste en diana.history.v1 / diana.profile.v1)

    await goAccount(page);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expectLogin(page);

    // A5: «Cerrar sesión» = SOLO este dispositivo (scope local).
    // (Corregido en este turno: antes usaba el default 'global'.)
    expect(s.logoutScopes).toContain('local');
    expect(s.logoutScopes).not.toContain('global');

    // Limpieza de storage local.
    const dianaAuth = await page.evaluate((k) => window.localStorage.getItem(k), DIANA_AUTH_KEY);
    expect(dianaAuth).toBeNull();
    const dianaKeys = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('diana.')));
    expect(dianaKeys).toEqual([]);
    expectNoConsole(errors);
  });

  test('e) cerrar en todos: scope global, con confirmación, limpia storage y vuelve a /login', async ({ page }) => {
    const { s, errors } = await signedInPage(page);
    await goAccount(page);
    await page.getByRole('button', { name: 'Cerrar en todos los dispositivos' }).click();
    // Confirmación (hoja) antes de actuar. «Cerrar» es ambiguo a nivel de
    // página (coinciden también «Cerrar sesión» y «Cerrar en todos…»):
    // se limita a la hoja.
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet.getByRole('button', { name: 'Cerrar' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expectLogin(page);

    expect(s.logoutScopes).toContain('global');
    const dianaAuth = await page.evaluate((k) => window.localStorage.getItem(k), DIANA_AUTH_KEY);
    expect(dianaAuth).toBeNull();
    expectNoConsole(errors);
  });

  test('f) borrar cuenta: exige la frase y llama a /functions/v1/delete-account con { everywhere: false }', async ({ page }) => {
    const { s, errors } = await signedInPage(page);
    await goAccount(page);
    await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();

    // «Borrar» es ambiguo a nivel de página (coinciden también «Borrar mi
    // cuenta» y «Borrar también mi acceso…»): se limita a la hoja.
    const sheet = page.getByTestId('bottom-sheet');
    // Con la frase incompleta, «Borrar» queda bloqueado.
    await page.getByTestId('confirm-phrase-input').fill('BORRAR MI CUENT');
    expect(await sheet.getByRole('button', { name: 'Borrar' }).isDisabled()).toBe(true);

    // Frase exacta → llamada con everywhere:false y vuelta a /login.
    await page.getByTestId('confirm-phrase-input').fill('BORRAR MI CUENTA');
    await sheet.getByRole('button', { name: 'Borrar' }).click();
    await expectLogin(page);

    expect(s.deleteCalls).toHaveLength(1);
    expect(JSON.parse(s.deleteCalls[0])).toEqual({ everywhere: false });
    expectNoConsole(errors);
  });

  test('f2) borrar TODO (VERTICE): mismo flujo con { everywhere: true }', async ({ page }) => {
    const { s, errors } = await signedInPage(page);
    await goAccount(page);
    await page.getByRole('button', { name: /Borrar también mi acceso a todas las apps de VERTICE/ }).click();
    await page.getByTestId('confirm-phrase-input').fill('BORRAR MI CUENTA');
    await page.getByRole('button', { name: 'Borrar todo' }).click();
    await expectLogin(page);

    expect(s.deleteCalls).toHaveLength(1);
    expect(JSON.parse(s.deleteCalls[0])).toEqual({ everywhere: true });
    expectNoConsole(errors);
  });

  test('g) exportar: descarga un JSON válido con el usuario y sus datos', async ({ page }) => {
    const { s, errors } = await signedInPage(page);
    await goAccount(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar mis datos' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^diana-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
    const tmpPath = join(mkdtempSync(join(tmpdir(), 'diana-e2e-')), download.suggestedFilename());
    await download.saveAs(tmpPath);
    const json = JSON.parse(readFileSync(tmpPath, 'utf8'));
    expect(json.app).toBe('diana');
    expect(json.user?.id).toBe(E2E_USER.id);
    expect(json.user?.email).toBe(E2E_USER.email);
    expect(Array.isArray(json.historyEntries)).toBe(true);
    expect(json.historyEntries.length).toBeGreaterThan(0);
    expectNoConsole(errors);
  });

  test('h) apariencia: elegir Oscuro persiste tras recargar', async ({ page }) => {
    const { errors } = await signedInPage(page);
    await page.getByRole('tab', { name: 'Perfil', exact: true }).click();
    await page.getByRole('tab', { name: 'Oscuro' }).click();
    // El documento web refleja el tema (data-theme=dark, lo pone ThemeProvider).
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');

    await page.reload();
    // Tras recargar volvemos a la última ruta (pantalla de Perfil), no a
    // Inicio: expo-router conserva la URL. El tema se comprueba igualmente.
    await expect(page.getByRole('heading', { name: 'Perfil' }).first()).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    // Persistido en la clave de ajustes (versión 2).
    const settings = await page.evaluate(() => window.localStorage.getItem('diana.settings'));
    expect(JSON.parse(settings ?? '{}').state?.appearance).toBe('dark');
    expectNoConsole(errors);
  });
});

function expectNoConsole(errors: string[]): void {
  expect(errors, `Errores de consola:\n${errors.join('\n')}`).toEqual([]);
}
