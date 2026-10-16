/**
 * E2E · Explorar (rediseño P12): un solo buscador, filtros en panel, chip
 * activo y su borrado. No depende de datos de catálogo (el mock no los trae).
 */
import { test, expect } from '@playwright/test';
import { bootApp, expectInicio } from './helpers';

test.describe('explorar (supabase simulado)', () => {
  test('buscador único, filtro de género con chip y borrado del chip', async ({ page }) => {
    const { errors } = await bootApp(page, { signedIn: true });
    await page.goto('/');
    await expectInicio(page);
    await page.getByRole('tab', { name: 'Explorar', exact: true }).click();

    // Un solo buscador (antes había dos).
    const search = page.getByPlaceholder(/Película, director, actor, género/i);
    await expect(search).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Explorar' }).first()).toBeVisible();

    // Abrir el panel de filtros y elegir un género.
    await page.getByRole('button', { name: /^Filtros/ }).click();
    const sheet = page.getByTestId('bottom-sheet');
    await sheet.getByText('Drama', { exact: true }).first().click();
    await sheet.getByRole('button').last().click(); // CTA «Ver N títulos»

    // El filtro aparece como chip y se puede quitar.
    const chip = page.getByRole('button', { name: 'Quitar filtro Drama' });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(chip).toHaveCount(0);
    // Sin assert de consola: el mock no sirve el catálogo (llamadas de búsqueda → 405).
    void errors;
  });
});
