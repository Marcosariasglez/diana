#!/usr/bin/env node
// scripts/check-features.mjs (fase A, A.4): comprobación SOLO LECTURA del pase
// de features contra producción (anon key). Uso: node scripts/check-features.mjs
//
// Imprime: nº de catalog_titles, nº de catalog_features, % cubierto, y nº de
// filas con status error en catalog_features_state (solo visible con
// service_role: con la anon key da 401 → se omite y se avisa).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.split('=')[0], l.split('=').slice(1).join('=')]),
);
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

async function count(token, table, col) {
  const res = await fetch(`${base}/rest/v1/${table}?select=${col}&limit=0`, {
    headers: { apikey: token, Authorization: `Bearer ${token}`, Prefer: 'count=exact', Range: '0-0' },
  });
  if (res.status !== 200 && res.status !== 206) return { error: res.status };
  return { total: Number((res.headers.get('content-range') ?? '/').split('/')[1] ?? 0) };
}

const titles = await count(anon, 'catalog_titles', 'tmdb_id');
const features = await count(anon, 'catalog_features', 'tmdb_id');

// El state es invisible para anon (401 por diseño); con service_role se puede
// ver el nº de errores (opcional, nunca se imprime la clave).
let stateErrors = null;
if (service) {
  const st = await count(service, 'catalog_features_state', 'tmdb_id');
  if (typeof st.total === 'number') {
    const res = await fetch(
      `${base}/rest/v1/catalog_features_state?select=tmdb_id&status=eq.error&limit=0`,
      {
        headers: { apikey: service, Authorization: `Bearer ${service}`, Prefer: 'count=exact', Range: '0-0' },
      },
    );
    if (res.status === 200 || res.status === 206) {
      stateErrors = Number((res.headers.get('content-range') ?? '/').split('/')[1] ?? 0);
    }
  }
}

const pct = titles.total && features.total ? ((features.total / titles.total) * 100).toFixed(1) : '0.0';
console.log(
  `features: ${features.total}/${titles.total} (${pct} %)` +
    (stateErrors !== null ? ` | estado error: ${stateErrors}` : ' | estado: no visible (sin service_role)'),
);
if (typeof titles.error === 'number') console.error('catalog_titles:', titles.error);
if (typeof features.error === 'number') console.error('catalog_features:', features.error);
