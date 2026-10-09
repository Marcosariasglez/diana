/**
 * Helpers de la suite E2E (VERTICE-NOCHE D-2).
 * Cada test crea su propio Page + su propio E2EState: los escenarios no se
 * pisan entre sí y cada uno arranca limpio (sin sesión, salvo que siembre).
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  collectConsoleErrors,
  createState,
  installSupabaseMock,
  seedGoogleSession,
  type E2EState,
} from './supabaseMock';

/** Crea una página con la app montada y el mock de Supabase instalado. */
export async function newAppPage(
  page: Page,
  s: E2EState = createState(),
  opts: { signedIn?: boolean; extraStorage?: Record<string, string> } = {},
): Promise<Page> {
  await installSupabaseMock(page, s);
  if (opts.signedIn) await seedGoogleSession(page, s);
  if (opts.extraStorage) {
    await page.addInitScript((entries) => {
      for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
    }, opts.extraStorage);
  }
  return page;
}

/** Espera a que la app muestre Inicio («Para ti»), sin importar el rebote por onboarding. */
export async function expectInicio(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Para ti' }).first()).toBeVisible({ timeout: 30_000 });
}

/** Espera a que la app muestre la pantalla de acceso. */
export async function expectLogin(page: Page): Promise<void> {
  await expect(page.getByTestId('login-email-input')).toBeVisible({ timeout: 30_000 });
}

/** Navega a Cuenta desde la pestaña Perfil («Gestionar cuenta»). */
export async function goAccount(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByRole('button', { name: 'Gestionar cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Cuenta' }).first()).toBeVisible();
}

/** Asegura que no haya errores de consola (el ruido del bundle se descarta en el collector). */
export function expectNoConsoleErrors(errors: string[]): void {
  expect(errors, `Errores de consola:\n${errors.join('\n')}`).toEqual([]);
}

/** Arranque estándar: mock + captura de errores + carga de la app. */
export async function bootApp(
  page: Page,
  opts: { state?: E2EState; signedIn?: boolean; extraStorage?: Record<string, string> } = {},
): Promise<{ s: E2EState; errors: string[] }> {
  const s = opts.state ?? createState();
  const errors = collectConsoleErrors(page);
  await newAppPage(page, s, { signedIn: opts.signedIn, extraStorage: opts.extraStorage });
  return { s, errors };
}
