/**
 * E2E · Inicio (rediseño P12): la pantalla carga sin errores, con cabecera y
 * pills de plataforma, y nunca enseña una nota de IA.
 */
import { test, expect } from '@playwright/test';
import { bootApp, expectInicio, expectNoConsoleErrors } from './helpers';

test.describe('inicio (supabase simulado)', () => {
  test('carga la cabecera «Para ti» y no muestra notas ni porcentajes de IA', async ({ page }) => {
    const { errors } = await bootApp(page, { signedIn: true });
    await page.goto('/');
    await expectInicio(page);
    await expect(page.getByRole('button', { name: /^Notificaciones/ })).toBeVisible();

    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\b[1-5],\d\b/);
    expect(text).not.toMatch(/\d+ ?%/);
    expect(text.toLowerCase()).not.toContain('nota estimada');
    expectNoConsoleErrors(errors);
  });
});
