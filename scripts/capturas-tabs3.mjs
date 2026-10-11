#!/usr/bin/env node
/**
 * scripts/capturas-tabs3.mjs
 * Capturas 390×844 (claro/oscuro) del rediseño de tabs (VERTICE-PLAN-2 C.1-C.3)
 * contra un build web MOCK servido en http://localhost:3000.
 *
 * Salida: docs/vertice/plan2/capturas/tabs3/
 *   - mood-solo-{light,dark}.png     (C.1: afinidad siempre visible)
 *   - mood-grupo-{light,dark}.png    (C.1: acciones de sala en modo «Con amigos»)
 *   - explorar-{light,dark}.png      (C.2: nueva tab)
 *   - inicio-{light,dark}.png        (nav de 4 tabs)
 *
 * Uso:
 *   npm run build:web && npx serve dist -l 3000   (otro terminal)
 *   node scripts/capturas-tabs3.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'docs', 'vertice', 'plan2', 'capturas', 'tabs3');
const WIDTH = 390;
const HEIGHT = 844;
const BASE_URL = process.env.CAPTURA_BASE_URL || 'http://localhost:3000';

mkdirSync(OUTPUT_DIR, { recursive: true });

async function seedProfile(page, onboarded = true) {
  await page.addInitScript(({ onboarded }) => {
    try {
      const profile = {
        state: {
          profile: {
            id: 'user-me',
            displayName: 'Marcos',
            initialRatings: {},
            favoriteGenres: [1, 2, 3],
            favoritePlatforms: ['netflix', 'prime-video', 'max', 'disney-plus'],
          },
          hasOnboarded: onboarded,
        },
        version: 1,
      };
      window.localStorage.setItem('diana.profile.v1', JSON.stringify(profile));
    } catch {
      /* sin storage */
    }
  }, { onboarded });
}

async function shoot(browser, name, path, { group = false } = {}) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      colorScheme: theme,
    });
    if (theme === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
    await seedProfile(page, true);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1200);
    if (group) {
      // C.1: conmutar a «Con amigos» (segmentado) para ver las acciones de sala.
      // (en web el role «tab» no se expone; se pulsa por el texto del segmento)
      await page.getByText('Con amigos', { exact: true }).click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    const file = join(OUTPUT_DIR, `${name}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ✓ ${name}-${theme}.png`);
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  console.log(`📸 Capturas tabs3 → ${OUTPUT_DIR}`);
  await shoot(browser, 'mood-solo', '/mood');
  await shoot(browser, 'mood-grupo', '/mood', { group: true });
  await shoot(browser, 'explorar', '/explore');
  await shoot(browser, 'inicio', '/');

  // C.3: verificar que /match redirige a /mood (no rompe enlaces antiguos).
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await seedProfile(page, true);
  await page.goto(`${BASE_URL}/match`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  const url = page.url();
  const ok = url.includes('/mood');
  console.log(ok ? `  ✓ /match redirige a ${url}` : `  ✗ /match NO redirige: ${url}`);
  if (!ok) process.exitCode = 1;
  await page.close();
} finally {
  await browser.close();
}
console.log('Listo.');
