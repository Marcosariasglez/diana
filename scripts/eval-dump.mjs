#!/usr/bin/env node
// scripts/eval-dump.mjs (fase A, A.6): volca los EMBEDDINGS REALES de gte-small
// de los N títulos más populares que YA tienen feature, para la re-evaluación
// offline del recomendador (node scripts/eval-recomendador.mjs --real).
//
// SOLO LECTURA (anon key). Salida: docs/vertice/plan2/eval-dump.json
// (gitignoreado: son ~N*1.4 KB de vectores). Uso:
//   node scripts/eval-dump.mjs            # 2000 títulos
//   node scripts/eval-dump.mjs --n 3000
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.split('=')[0], l.split('=').slice(1).join('=')]),
);
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const argN = (() => {
  const i = process.argv.indexOf('--n');
  return i >= 0 ? Number(process.argv[i + 1]) || 2000 : 2000;
})();

async function fetchPage(from, to) {
  // PostgREST: el orden se pide con el parámetro `order=` (no existe cabecera x-order).
  const res = await fetch(
    `${base}/rest/v1/catalog_titles?select=*&order=popularity.desc,tmdb_id.asc`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Range: `${from}-${to}`,
        RangeUnit: 'items',
      },
    },
  );
  if (res.status !== 200) throw new Error(`catalog_titles ${res.status}`);
  return res.json();
}

// La columna vector llega por REST como string "[-0.1,0.2,...]"; se normaliza a array.
function parseEmbedding(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.length > 2) {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }
  return null;
}

// 1) Títulos populares (la misma población que usa el feed).
const TITLES_PAGE = 500;
const titles = [];
for (let from = 0; from < argN; from += TITLES_PAGE) {
  const to = Math.min(from + TITLES_PAGE - 1, argN - 1);
  const rows = await fetchPage(from, to);
  titles.push(...rows);
  if (rows.length < TITLES_PAGE) break;
}

// 2) Features de esos títulos (por lotes de 1000 con in=).
const byType = { movie: [], tv: [] };
for (const t of titles) byType[t.media_type].push(t.tmdb_id);
const features = new Map(); // `${type}:${id}` -> row
for (const [type, ids] of Object.entries(byType)) {
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const q = `${base}/rest/v1/catalog_features?select=*` +
      `&media_type=eq.${type}&tmdb_id=in.(${chunk.join(',')})`;
    const res = await fetch(q, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    if (res.status !== 200) throw new Error(`catalog_features ${res.status}`);
    for (const r of await res.json()) features.set(`${type}:${r.tmdb_id}`, r);
  }
}

const out = [];
for (const t of titles) {
  const f = features.get(`${t.media_type}:${t.tmdb_id}`);
  if (!f) continue;
  const embedding = parseEmbedding(f.embedding);
  if (!embedding || embedding.length !== 384) continue;
  out.push({
    id: t.tmdb_id,
    type: t.media_type,
    title: t.title,
    original_title: t.original_title,
    overview: t.overview,
    genre_ids: t.genre_ids,
    year: t.year,
    vote_average: t.vote_average,
    vote_count: t.vote_count,
    popularity: t.popularity,
    embedding,
  });
}

const dir = join(root, 'docs', 'vertice', 'plan2');
mkdirSync(dir, { recursive: true });
const p = join(dir, 'eval-dump.json');
writeFileSync(p, JSON.stringify({ n: out.length, from: argN, date: new Date().toISOString(), items: out }));
console.log(`OK → ${p} (${out.length}/${argN} títulos con embedding real de 384 dims)`);
if (out.length < Math.min(500, argN)) {
  console.error('AVISO: cobertura baja (el backfill aún no ha llegado a estos títulos); relanzar cuando avance.');
}
