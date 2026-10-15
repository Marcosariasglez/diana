#!/usr/bin/env node
/**
 * scripts/capturas-ui.mjs
 * Capturas 390×844 (x2) de TODAS las pantallas contra el build web servido
 * por scripts/serve-spa.mjs. Sirve para la auditoría visual del plan
 * docs/vertice/plan-ajustes-oct13.md (capturas «antes» y «después»).
 *
 * Uso (ver «Cómo capturar» en el plan):
 *   node scripts/capturas-ui.mjs <carpeta-salida> [baseUrl]
 *   node scripts/capturas-ui.mjs docs/vertice/capturas/ajustes-oct13/despues
 *
 * Nota: usa fixtures de historial y perfil en localStorage (sin servidor).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const OUT = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:3111';
if (!OUT) {
  console.error('Uso: node scripts/capturas-ui.mjs <carpeta-salida> [baseUrl]');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const now = Date.now();
const mk = (key, mediaType, mediaId, title, rating, daysAgo, extra = {}) => ({
  key, ref: { mediaType, mediaId }, title, posterColor: '#7a5af8', userRating: rating,
  aiPrediction: 3.5, predictionSeen: true,
  ratedAt: new Date(now - daysAgo * 864e5).toISOString(), source: 'app', ...extra,
});
const history = {
  state: {
    entries: [
      mk('movie:1', 'movie', 1, 'Dune: Parte Dos', 4.5, 0),
      mk('tv:52', 'tv', 52, 'Breaking Bad', 5, 1),
      mk('movie:2', 'movie', 2, 'Oppenheimer', 4, 2),
      mk('tv:54', 'tv', 54, 'The Bear', 3.5, 3),
      mk('movie:3', 'movie', 3, 'Parásitos', 5, 5),
      mk('movie:4', 'movie', 4, 'Barbie', 3, 9),
    ],
    watched: [],
  },
  version: 1,
};
const profile = {
  state: {
    profile: { id: 'user-me', displayName: 'Marcos', initialRatings: {}, favoriteGenres: [1, 2, 3], favoritePlatforms: ['netflix', 'prime-video', 'max', 'disney-plus'] },
    hasOnboarded: true,
  },
  version: 1,
};

const browser = await chromium.launch();
async function shot(name, path, { onboarded = true, theme = 'light', full = false, act, seedHistory = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(({ profile, history, onboarded, seedHistory }) => {
    try {
      if (onboarded) localStorage.setItem('diana.profile.v1', JSON.stringify(profile));
      if (seedHistory) localStorage.setItem('diana.history.v1', JSON.stringify(history));
    } catch { /* sin storage */ }
  }, { profile, history, onboarded, seedHistory });
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (act) { try { await act(page); } catch (e) { console.log('  ! acción falló en', name, e.message.split('\n')[0]); } }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log('  ✓', name);
  await ctx.close();
}

const searchDiary = (q) => async (p) => {
  await p.getByPlaceholder(/Buscar películas/i).fill(q);
  await p.waitForTimeout(1800);
};

await shot('01-welcome', '/', { onboarded: false });
await shot('02-inicio', '/', { full: true });
await shot('03-explorar', '/explore');
await shot('03b-explorar-busqueda', '/explore', { act: async (p) => { await p.getByPlaceholder(/Buscar/i).first().fill('the'); await p.waitForTimeout(1500); } });
await shot('04-mood', '/mood');
await shot('05-mood-wizard', '/mood-wizard');
await shot('06-perfil', '/profile', { full: true });
await shot('07-diario-vacio', '/daily-log');
await shot('07b-diario-resultados', '/daily-log', { act: searchDiary('the') });
await shot('07c-diario-foco', '/daily-log', { act: async (p) => { await p.getByPlaceholder(/Buscar películas/i).click(); } });
await shot('07d-diario-ficha', '/daily-log', { act: async (p) => { await searchDiary('bear')(p); await p.getByRole('button', { name: /Serie: The Bear/i }).first().click(); await p.waitForTimeout(800); } });
await shot('08-ficha-peli', '/detail/1?type=movie', { full: true });
await shot('09-ficha-serie', '/detail/52?type=tv', { full: true });
await shot('10-notificaciones', '/notifications');
await shot('11-ver-todo', '/see-all/hidden-gems');
await shot('12-sala-unirse', '/room/join');
await shot('13-cuenta', '/account');
await shot('14-login', '/login', { onboarded: false });
await shot('15-404', '/ruta-que-no-existe');
await shot('16-perfil-oscuro', '/profile', { theme: 'dark', full: true });
await shot('17-inicio-oscuro', '/', { theme: 'dark' });
await shot('18-diario-oscuro', '/daily-log', { theme: 'dark', act: searchDiary('the') });

// ── Flujos con interacción ──────────────────────────────────────────────
async function flow(name, { onboarded = true, run }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(({ profile, onboarded }) => {
    try { if (onboarded) localStorage.setItem('diana.profile.v1', JSON.stringify(profile)); } catch { /* sin storage */ }
  }, { profile, onboarded });
  try { await run(page); } catch (e) { console.log('  ! flujo falló en', name, e.message.split('\n')[0]); }
  await ctx.close();
}
const snap = (page, file, full = false) => page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });

await flow('swipe-onboarding', {
  onboarded: false,
  run: async (p) => {
    await p.goto(BASE + '/'); await p.waitForTimeout(1500);
    await p.getByText('Empezar test rápido').click(); await p.waitForTimeout(1500);
    await snap(p, '19-swipe-onboarding');
  },
});
await flow('mood-solo', {
  run: async (p) => {
    await p.goto(BASE + '/mood'); await p.waitForTimeout(1200);
    await p.getByText('Empezar', { exact: true }).click(); await p.waitForTimeout(800);
    await p.getByText('Menos de 90 min').click(); await p.waitForTimeout(700);
    await snap(p, '20-mood-paso2');
    await p.getByText('Tranquila').click(); await p.waitForTimeout(700);
    await p.getByText('Solo', { exact: true }).click(); await p.waitForTimeout(700);
    await snap(p, '21-mood-plataformas');
    await p.getByText(/Ver resultados|Continuar|Siguiente|Terminar/i).first().click(); await p.waitForTimeout(3500);
    await snap(p, '22-mood-resultados', true);
  },
});
await flow('mood-amigos', {
  run: async (p) => {
    await p.goto(BASE + '/mood'); await p.waitForTimeout(1200);
    await p.getByText('Con amigos').click(); await p.waitForTimeout(700);
    await snap(p, '23-mood-amigos');
  },
});
await browser.close();
console.log('Capturas en', OUT);
