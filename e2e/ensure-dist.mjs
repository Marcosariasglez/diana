#!/usr/bin/env node
// Genera (o reutiliza) un dist/ con el entorno fijo que necesita la suite E2E:
// BACKEND=supabase apuntando a este mismo origen (http://127.0.0.1:4319/e2e-sb),
// de modo que page.route pueda interceptar todas las llamadas a Supabase sin CORS.
// Si ya existe un dist/ con el mismo entorno (marcador dist/.e2e-env.json), se reutiliza.
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
if (existsSync(join(root, 'dist', 'index.html')) && existsSync(markerPath) && readFileSync(markerPath, 'utf8') === marker) {
  console.log('[e2e] dist/ reutilizado (mismo entorno)');
  process.exit(0);
}
console.log('[e2e] Build de dist/ para E2E (BACKEND=supabase, origen propio)...');
// En Windows `npx` es un .cmd (spawnSync sin shell falla); se lanza el CLI de
// Expo directamente con el intérprete de Node (portable).
const expoCli = join(root, 'node_modules', 'expo', 'bin', 'cli');
execFileSync(process.execPath, [expoCli, 'export', '--platform', 'web'], {
  cwd: root,
  env: { ...process.env, ...env },
  stdio: 'inherit',
});
execFileSync('node', ['scripts/postbuild-pwa.mjs'], {
  cwd: root,
  env: { ...process.env, EXPO_BASE_URL: '' },
  stdio: 'inherit',
});
writeFileSync(markerPath, marker);
console.log('[e2e] dist/ listo para la suite E2E');
