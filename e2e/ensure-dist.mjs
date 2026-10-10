#!/usr/bin/env node
// Genera (o reutiliza) un dist/ con el entorno fijo que necesita la suite E2E:
// BACKEND=supabase apuntando a este mismo origen (http://127.0.0.1:4319/e2e-sb),
// de modo que page.route pueda interceptar todas las llamadas a Supabase sin CORS.
//
// Reutilización por marcador dist/.e2e-env.json, con DOS salvaguardas aprendidas
// en el turno de plan2 (2026-10-09):
//  1. `--clear` en cada build nuevo: Metro cachea el transform de src/lib/env.ts
//     SIN las variables EXPO_PUBLIC_*, y `expo export` reutilizaba esa caché
//     aunque el entorno cambiara (bundle 'mock' con marcador 'supabase').
//  2. Verificación empírica del bundle tras el build: si no contiene el origen
//     e2e ni la anon key de E2E, el build NO se marca como válido y el script
//     falla ruidoso. El marcador solo escribe si la verificación pasa.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  EXPO_PUBLIC_BACKEND: 'supabase',
  EXPO_PUBLIC_CATALOG: 'mock',
  EXPO_PUBLIC_BASE_URL: '',
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4319/e2e-sb',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
};
const markerPath = join(root, 'dist', '.e2e-env.json');
const marker = JSON.stringify(env);

/** Lee el bundle JS principal de dist/ (el que referencia index.html). */
function readMainBundle() {
  const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  const m = html.match(/<script[^>]*src="([^"]+\.js)"/);
  if (!m) throw new Error('dist/index.html sin <script src=...>: no puedo verificar el bundle');
  const rel = m[1].replace(/^\//, '');
  return readFileSync(join(root, 'dist', rel), 'utf8');
}

/**
 * El bundle DEBE llevar el entorno E2E inlinado; si no, es un build viejo o
 * mentiroso (caché de Metro con env vacío). Devuelve los problemas (vacío = OK).
 */
function bundleProblems() {
  const bundle = readMainBundle();
  const problems = [];
  if (!bundle.includes('127.0.0.1:4319')) problems.push('sin el origen e2e (127.0.0.1:4319)');
  if (!bundle.includes('e2e-anon-key')) problems.push('sin la anon key de E2E (e2e-anon-key)');
  return problems;
}

if (existsSync(join(root, 'dist', 'index.html')) && existsSync(markerPath) && readFileSync(markerPath, 'utf8') === marker) {
  // El marcador dice que es válido, pero compruebo de todos modos el bundle:
  // un build corrupto (caché de Metro) invalida el marcador y fuerza rebuild.
  const problems = bundleProblems();
  if (problems.length === 0) {
    console.log('[e2e] dist/ reutilizado (mismo entorno, bundle verificado)');
    process.exit(0);
  }
  console.log('[e2e] Marcador válido pero bundle incoherente (' + problems.join(' · ') + '); fuerzo rebuild...');
}
console.log('[e2e] Build de dist/ para E2E (BACKEND=supabase, origen propio)...');
// En Windows `npx` es un .cmd (spawnSync sin shell falla); se lanza el CLI de
// Expo directamente con el intérprete de Node (portable).
// `--clear`: limpia la caché de Metro ANTES de exportar; sin esto, un bundle
// previo con env vacío se sirve aunque el entorno haya cambiado.
const expoCli = join(root, 'node_modules', 'expo', 'bin', 'cli');
execFileSync(process.execPath, [expoCli, 'export', '--platform', 'web', '--clear'], {
  cwd: root,
  env: { ...process.env, ...env },
  stdio: 'inherit',
});
execFileSync('node', ['scripts/postbuild-pwa.mjs'], {
  cwd: root,
  env: { ...process.env, EXPO_BASE_URL: '' },
  stdio: 'inherit',
});
const problems = bundleProblems();
if (problems.length) {
  console.error('[e2e] ERROR: el bundle recién hecho no lleva el entorno E2E:', problems.join(' · '));
  console.error('[e2e] No se escribe el marcador. Limpia .expo/web y node_modules/.cache y reintenta.');
  process.exit(1);
}
console.log('[e2e] Bundle verificado: lleva el entorno E2E inlinado.');
writeFileSync(markerPath, marker);
console.log('[e2e] dist/ listo para la suite E2E');
