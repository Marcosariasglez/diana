#!/usr/bin/env node
/**
 * scripts/capturas.mjs
 * Capturas de pantalla 390×844 (claro y oscuro) de Diana con BACKEND=mock.
 *
 * Uso:
 *   node scripts/capturas.mjs              # captura "antes" en docs/vertice/capturas/antes/
 *   node scripts/capturas.mjs --despues    # captura "despues" en docs/vertice/capturas/despues/
 *   node scripts/capturas.mjs --folder=mi-carpeta
 *
 * Pre-requisitos:
 *   npx playwright install chromium         (navegador)
 *   npm run build:web                      (genera dist/)
 *   npx serve dist -l 3000                 (servidor en otro terminal)
 *   BACKEND=mock (por defecto)
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Pantallas a capturar (rutas relativas a la app servida)
// `welcome` se siembra con hasOnboarded=false (el guard la redirige a / si ya
// hay onboarding); el resto, con hasOnboarded=true.
const SCREENS = [
  // Principales
  { name: 'login', path: '/login', onboarded: true },
  { name: 'welcome', path: '/welcome', onboarded: false },
  { name: 'inicio', path: '/', onboarded: true },
  { name: 'mood', path: '/mood', onboarded: true },
  { name: 'match', path: '/match', onboarded: true },
  { name: 'perfil', path: '/profile', onboarded: true },
  { name: 'cuenta', path: '/account', onboarded: true },
  // Secundarias
  { name: 'daily-log', path: '/daily-log', onboarded: true },
  { name: 'notifications', path: '/notifications', onboarded: true },
  { name: 'not-found', path: '/__not-found__', onboarded: true },
  // Estados especiales (se capturan pero pueden redirigir)
  { name: 'room-join', path: '/room/join', onboarded: true },
];

const WIDTH = 390;
const HEIGHT = 844;
const BASE_URL = process.env.CAPTURA_BASE_URL || 'http://localhost:3000';

// Determinar carpeta de salida
const args = process.argv.slice(2);
const despues = args.includes('--despues');
const folderArg = args.find((a) => a.startsWith('--folder='));
const folderName = folderArg ? folderArg.split('=')[1] : (despues ? 'despues' : 'antes');
const OUTPUT_DIR = join(ROOT, 'docs', 'vertice', 'capturas', folderName);

mkdirSync(OUTPUT_DIR, { recursive: true });

async function capture() {
  console.log(`📸 Capturas → ${OUTPUT_DIR}`);
  console.log(`🌐 ${BASE_URL}`);
  console.log(`📱 ${WIDTH}×${HEIGHT}`);

  const browser = await chromium.launch({ headless: true });
  const report = [];

  try {
    for (const theme of ['light', 'dark']) {
      for (const screen of SCREENS) {
        const page = await browser.newPage({
          viewport: { width: WIDTH, height: HEIGHT },
          colorScheme: theme,
        });

        // Aplicar tema oscuro si corresponde
        if (theme === 'dark') {
          await page.emulateMedia({ colorScheme: 'dark' });
        }

        try {
          // Sembrar storage (mock): usuario con onboarding completado para ver la
          // app real (o sin onboarding, para poder ver la bienvenida).
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
              // sin storage disponible: se captura igual
            }
          }, { onboarded: screen.onboarded });

          await page.goto(`${BASE_URL}${screen.path}`, {
            waitUntil: 'networkidle',
            timeout: 15000,
          });

          // Esperar a que React se hidrate
          await page.waitForTimeout(1000);

          const filePath = join(OUTPUT_DIR, `${screen.name}-${theme}.png`);
          await page.screenshot({ path: filePath, fullPage: false });
          console.log(`  ✓ ${screen.name}-${theme}.png`);
          report.push({ screen: screen.name, theme, ok: true });
        } catch (err) {
          console.error(`  ✗ ${screen.name}-${theme}: ${err.message}`);
          report.push({ screen: screen.name, theme, ok: false, error: err.message });
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Escribir informe
  const ok = report.filter((r) => r.ok).length;
  const fail = report.filter((r) => !r.ok).length;
  console.log(`\n📊 ${ok} ok, ${fail} fallidos de ${report.length}`);

  if (fail > 0) {
    console.log('Fallos:');
    report.filter((r) => !r.ok).forEach((r) => {
      console.log(`  ${r.screen}-${r.theme}: ${r.error}`);
    });
  }

  const informe = JSON.stringify(report, null, 2);
  writeFileSync(join(OUTPUT_DIR, 'informe.json'), informe, 'utf-8');
  console.log(`\nInforme: ${join(OUTPUT_DIR, 'informe.json')}`);

  process.exit(fail > 0 ? 1 : 0);
}

capture().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
