// P.0.1: recuentos de producción (SOLO LECTURA, anon key). Uso: node scripts/.tmp-p0.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.split('=')[0], l.split('=').slice(1).join('=')]),
);
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function count(table, col) {
  const res = await fetch(`${base}/rest/v1/${table}?select=${col}&limit=0`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = res.headers.get('content-range') ?? '';
  if (res.status === 200 || res.status === 206) return { status: res.status, total: range.split('/')[1] ?? null };
  return { status: res.status, body: (await res.text()).slice(0, 150) };
}

for (const [t, c] of [
  ['catalog_titles', 'tmdb_id'],
  ['catalog_features', 'tmdb_id'],
  ['catalog_features_state', 'tmdb_id'],
  ['watchlist', 'user_id'],
  ['rooms', 'code'],
  ['history_entries', 'user_id'],
]) {
  console.log(t, JSON.stringify(await count(t, c)));
}
