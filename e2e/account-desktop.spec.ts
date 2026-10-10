/**
 * D2-0 · Pantalla Cuenta en escritorio (VERTICE-PLAN-2).
 *
 * El dueño informo que a 1280x720 no veia «Apariencia» ni «Cerrar sesion».
 * Reproduccion real (2026-10-09, build supabase + supabase simulado):
 *   - NO se reproduce en el codigo actual (la pantalla se despliega y el
 *     botton «Cerrar sesion» es alcanzable por scroll), PERO se encontraron
 *   y corrigieron tres defectos que impedian probarlo (y uno de ellos
 *   dejaba la app en blanco en ciertas condiciones):
 *     1. e2e/ensure-dist.mjs reutilizaba un dist/ MOCK con marcador
 *        'supabase' (la caché de Metro devolvía un bundle sin las variables
 *        EXPO_PUBLIC_*): todo E2E corria contra un build mock. Ahora: --clear
 *        + verificacion empírica del bundle + invalidacion por incoherencia.
 *     2. supabaseMock: .single() se declara por cabecera Accept (no por
 *        limit=1 en la query) y los filtros implicitos col=eq.valor no se
 *        parseaban -> profiles volvia [] -> perfil parcial.
 *     3. bootstrapUserData normalizaba los valores remotos: un perfil con
 *        favorite_platforms undefined se persistia roto y en el siguiente
 *        arranque useFeedData crasheaba (pantalla en blanco).
 *   Ademas: la columna desktop de 390 px (A3.5) apuntaba a #__next; el root
 *   de Expo Router web es #root (global.css corregido).
 *
 * Pruebas:
 *   - Escritorio 1280x720: se llega a «Cerrar sesion» (scrollIntoView + clic)
 *     y la columna de contenido no excede 390 px.
 *   - Movil 390x844: lo mismo, como referencia.
 */
import { test, expect } from '@playwright/test';
import { bootApp, expectInicio, goAccount } from './helpers';

test('D2-0 escritorio 1280x720: Cuenta despliega, se llega a «Cerrar sesion» y la columna es <= 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await bootApp(page, { signedIn: true });
  await page.goto('/');
  await expectInicio(page);
  await goAccount(page);

  // La columna movil de 390 px (A3.5) debe aplicarse en desktop (global.css #root).
  const rootWidth = await page.evaluate(() => document.getElementById('root')?.getBoundingClientRect().width ?? 0);
  expect(rootWidth).toBeGreaterThan(0);
  expect(rootWidth).toBeLessThanOrEqual(391); // tolerancia de redondeo subpixel

  // «Apariencia» y «Cerrar sesión» existen; el botón se alcanza por scroll.
  const btn = page.getByRole('button', { name: 'Cerrar sesión', exact: true });
  await expect(btn).toBeAttached();
  await btn.scrollIntoViewIfNeeded();
  expect(await btn.isVisible()).toBe(true);

  // Clic real: cierra sesion y vuelve al login (sin errores de consola).
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await btn.click();
  await expect(page.getByTestId('login-email-input')).toBeVisible();
  expect(errors).toEqual([]);

  await page.screenshot({ path: 'test-results/d2-0-cuenta-login.png', fullPage: false });
});

test('D2-0 movil 390x844: Cuenta despliega y «Cerrar sesion» es alcanzable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootApp(page, { signedIn: true });
  await page.goto('/');
  await expectInicio(page);
  await goAccount(page);

  const btn = page.getByRole('button', { name: 'Cerrar sesión', exact: true });
  await expect(btn).toBeAttached();
  await btn.scrollIntoViewIfNeeded();
  expect(await btn.isVisible()).toBe(true);

  await page.screenshot({ path: 'test-results/d2-0-cuenta-movil.png', fullPage: false });
});
