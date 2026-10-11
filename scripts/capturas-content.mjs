#!/usr/bin/env node
/**
 * scripts/capturas-content.mjs — VERTICE-PLAN-2 A.7
 *
 * Capturas 390×844 (claro/oscuro) del Inicio con el feed en modo `content`:
 * build supabase-simulado del arnés e2e (BACKEND=supabase + CATALOG=tmdb +
 * RECOMMENDER=content, mismo origen 127.0.0.1/e2e-sb que la suite E2E) y un
 * mini-mock de Supabase que responde el RPC `recommend` con candidatos +
 * explicación «Porque te gustó …» (mismo contrato de fila que el RPC 0007).
 *
 * Salida: docs/vertice/plan2/capturas/tabs3/inicio-content-{light,dark}.png
 *
 * USO (dist/ debe estar construido CON el entorno de content; ver el informe):
 *   1) mover .env.local a un lado (SDK 57: el fichero gana sobre process.env)
 *   2) EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_CATALOG=tmdb
 *      EXPO_PUBLIC_RECOMMENDER=content
 *      EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:4319/e2e-sb
 *      EXPO_PUBLIC_SUPABASE_ANON_KEY=e2e-anon-key
 *      npx expo export --platform web --clear && node scripts/postbuild-pwa.mjs
 *   3) node scripts/capturas-content.mjs
 *   4) restaurar .env.local
 *
 * El script levanta su propio servidor estático (e2e/server.mjs) en el puerto
 * 4321 (E2E_PORT) para no pisar la suite E2E (4319) y lo mata al terminar.
 * Los fixtures son simulados (documentado en el informe A.7): la captura
 * demuestra el rendering de la explicación + el carril; la calidad del
 * contenido real la da el backfill de features + la evaluación de A.6.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'docs', 'vertice', 'plan2', 'capturas', 'tabs3');
const PORT = 4321;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WIDTH = 390;
const HEIGHT = 844;
const USER_ID = '33333333-3333-4333-8333-333333333333';

mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Fixtures estáticos (misma forma de columnas que 0001/0007; datos simulados)
// ---------------------------------------------------------------------------

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeJwt(sub, expOffsetSec = 3600) {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({ sub, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + expOffsetSec });
  return `${header}.${payload}.`;
}
const iso = () => new Date().toISOString();

/** Sesión en el formato exacto que auth-js persiste (clave vertice-diana-auth). */
const SESSION = {
  access_token: makeJwt(USER_ID),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'e2e-content-refresh',
  scope: 'email',
  user: {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'content-capture@ejemplo.com',
    email_confirmed_at: iso(),
    phone: '',
    confirmed_at: iso(),
    last_sign_in_at: iso(),
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {},
    identities: [
      {
        id: b64url(`identity-${USER_ID}`),
        user_id: USER_ID,
        identity_data: { sub: b64url(`ext-${USER_ID}`), email: 'content-capture@ejemplo.com' },
        provider: 'google',
        last_sign_in_at: iso(),
        created_at: iso(),
        updated_at: iso(),
      },
    ],
    created_at: iso(),
    updated_at: iso(),
    is_anonymous: false,
  },
};

/** Perfil (0001, snake_case): onbordeado + plataformas del feed. */
const PROFILE_ROW = {
  id: USER_ID,
  display_name: 'Marcos',
  favorite_platforms: ['netflix', 'prime-video'],
  favorite_genres: [1, 2, 18],
  has_onboarded: true,
  created_at: iso(),
  updated_at: iso(),
};

/** Historial simulado (source letterboxd): da «taste» al usuario. */
const HISTORY_ROWS = [
  {
    user_id: USER_ID, key: 'movie:872585', media_type: 'movie', media_id: 872585,
    season: null, episode: null, title: 'Dune: Part Two', user_rating: 5,
    source: 'letterboxd', rated_at: '2026-09-10T12:00:00.000Z',
  },
  {
    user_id: USER_ID, key: 'movie:496243', media_type: 'movie', media_id: 496243,
    season: null, episode: null, title: 'Oppenheimer', user_rating: 4.5,
    source: 'letterboxd', rated_at: '2026-09-01T12:00:00.000Z',
  },
];

/**
 * Filas del RPC `recommend` (contrato 0007: media_type, tmdb_id, title,
 * poster_path, score [-1,1], explanation «Porque te gustó X»).
 * score > 0.25 → cubo «alto» en la tarjeta destacada.
 */
const RECOMMEND_ROWS = [
  {
    media_type: 'movie', tmdb_id: 27205, title: 'Inception',
    poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    score: 0.6, explanation: ['Porque te gustó Dune: Part Two'],
  },
  {
    media_type: 'movie', tmdb_id: 157336, title: 'Interstellar',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    score: 0.45, explanation: ['Porque te gustó Oppenheimer'],
  },
  {
    media_type: 'movie', tmdb_id: 155, title: 'The Dark Knight',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    score: 0.3, explanation: ['Porque te gustó Inception'],
  },
];

const calls = { recommend: 0, tables: new Set() };

// ---------------------------------------------------------------------------
// Mini-mock de Supabase (misma forma de respuestas que el arnés e2e)
// ---------------------------------------------------------------------------

async function mockSupabase(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (!url.pathname.startsWith('/e2e-sb/')) return route.continue();
  const p = url.pathname.slice('/e2e-sb'.length);
  const method = req.method().toUpperCase();

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Range': '',
  };
  const json = (status, body) => route.fulfill({ status, headers, body: JSON.stringify(body) });

  if (method === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  // GoTrue: con la sesión sembrada y vigente no hay llamadas de red;
  // se responde por si auth-js refresca.
  if (p.startsWith('/auth/v1/')) {
    if (p.startsWith('/auth/v1/token') && method === 'POST') {
      return json(200, SESSION);
    }
    return json(200, SESSION.user);
  }

  if (p.startsWith('/rest/v1/')) {
    const rest = p.slice('/rest/v1/'.length);
    const tableName = rest.split('?')[0];

    // RPC recommend: el corazón de la captura A.7.
    if (tableName === 'rpc/recommend' && method === 'POST') {
      calls.recommend++;
      return json(200, RECOMMEND_ROWS);
    }

    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (method === 'GET') {
      if (tableName === 'profiles') {
        return wantsObject ? json(200, PROFILE_ROW) : json(200, [PROFILE_ROW]);
      }
      if (tableName === 'initial_ratings') return json(200, []);
      if (tableName === 'history_entries') return json(200, wantsObject ? null : HISTORY_ROWS);
      if (tableName === 'watched') return json(200, []);
      calls.tables.add(tableName);
      // Demás tablas (catalog_titles, rooms…): vacías — la home no las necesita
      // para el feed content y un 404 haría renderizar ErrorState.
      return wantsObject ? json(406, { message: 'PGRST116', code: 'PGRST116' }) : json(200, []);
    }
    return json(204, {});
  }

  return route.continue();
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

const server = spawn(process.execPath, [join(ROOT, 'e2e', 'server.mjs')], {
  cwd: ROOT,
  env: { ...process.env, E2E_PORT: String(PORT) },
  stdio: ['ignore', 'inherit', 'inherit'],
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ headless: true });
try {
  console.log(`📸 Capturas A.7 (feed content simulado) → ${OUTPUT_DIR}`);
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      colorScheme: theme,
    });
    if (theme === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript((sess) => {
      window.localStorage.setItem('vertice-diana-auth', sess);
    }, JSON.stringify(SESSION));
    await page.route('**/e2e-sb/**', mockSupabase);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 20000 });
    // A.7: la explicación «Porque te gustó …» se pinta bajo la plataforma.
    await page.getByText('Porque te gustó Dune: Part Two').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(900);
    const rail = await page.getByText('Recomendaciones', { exact: true }).count();
    const file = join(OUTPUT_DIR, `inicio-content-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const noise = errors.filter((e) => !/favicon|ResizeObserver/i.test(e));
    console.log(
      `  ✓ inicio-content-${theme}.png (carril: ${rail ? 'visible' : 'AUSENTE'} · errores consola: ${noise.length ? noise.join(' | ') : 'ninguno'})`,
    );
    if (!rail || noise.length) process.exitCode = 1;
    await page.close();
  }
  if (calls.recommend === 0) {
    console.error('  ✗ el RPC recommend nunca se llamó (¿el build no va con RECOMMENDER=content?)');
    process.exitCode = 1;
  } else {
    console.log(`  ✓ RPC recommend invocado (${calls.recommend}×) · tablas extra leídas: ${[...calls.tables].join(', ') || 'ninguna'}`);
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('Listo.');
