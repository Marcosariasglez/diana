#!/usr/bin/env node
/**
 * scripts/verify-catalog.mjs — VERTICE-PLAN-2 D2-1.8: comprobación de cobertura.
 *
 * Por cada proveedor de España (fuente: src/constants/providers.ts) y cada
 * tipo (movie/tv) × monetización (flatrate, rent|buy) compara:
 *   - total_results de TMDB (discover con with_watch_providers, ES)
 *   - filas de `catalog_titles` en Supabase que lo llevan en su array de
 *     plataforma (flatrate / rent o buy)
 * y FALLA si faltan más del 5 % (con un margen absoluto mínimo de 20 títulos).
 *
 * Además estima el tamaño de base (filas × bytes estimados por fila) frente al
 * límite de 500 MB del plan gratuito de Supabase (verificado en docs 2026-10).
 *
 * Uso:
 *   TMDB_READ_TOKEN=eyJ... node scripts/verify-catalog.mjs
 *   node scripts/verify-catalog.mjs --token=eyJ... --url=https://xxx.supabase.co --key=anon
 *   (sin token: se salta la comparación con TMDB y solo cuenta filas → exit 0)
 *
 * Requiere leer `catalog_titles` (RLS pública) — basta la anon key. No toca
 * `catalog_sync_state` (invisible para el cliente).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMDB = 'https://api.themoviedb.org/3';
const DB_LIMIT_MB = 500;
/** Bytes estimados por fila en disco (columnas + GIN/fts/trgm). Estimación
 *  conservadora documentada: title/overview/arrays/índices ≈ 0.45 KB. */
const BYTES_PER_ROW = 450;
const TOLERANCE = 0.05;
const ABS_MIN_MISSING = 20;

// ---------------------------------------------------------------------------
// Config (args > env)
// ---------------------------------------------------------------------------
function arg(name) {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split('=')[1] : undefined;
}
const TOKEN = arg('token') ?? process.env.TMDB_READ_TOKEN ?? process.env.TMDB_API_KEY ?? '';
const SUPA_URL = (arg('url') ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPA_KEY = arg('key') ?? process.env.SUPABASE_ANON_KEY ?? '';

// ---------------------------------------------------------------------------
// Proveedores: se leen de src/constants/providers.ts (fuente única, D2-1.1).
// Formato conocido: id: 'x', tmdbProviderId: N|null, es: true|false.
// ---------------------------------------------------------------------------
export function parseProvidersSource(src) {
  const out = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?tmdbProviderId:\s*(\d+|null)[\s\S]*?es:\s*(true|false)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ id: m[1], tmdbProviderId: m[2] === 'null' ? null : Number(m[2]), es: m[3] === 'true' });
  }
  return out;
}

/** Solo los proveedores ES con id TMDB verificado (los que sincroniza catalog-sync). */
export function syncableProviders(all) {
  return all.filter((p) => p.es && p.tmdbProviderId !== null);
}

function loadProviders() {
  const src = readFileSync(join(ROOT, 'src', 'constants', 'providers.ts'), 'utf8');
  return syncableProviders(parseProvidersSource(src));
}

// ---------------------------------------------------------------------------
// Decisión de cobertura (función pura, testable)
// ---------------------------------------------------------------------------
// Mantiene la MISMA lógica que src/lib/catalogCoverage.ts (fuente de verdad,
// testeada en catalogCoverage.test.ts). Replica porque Node no importa .ts.
export function coverageVerdict(tmdbTotal, dbRows) {
  const missing = Math.max(0, tmdbTotal - dbRows);
  if (tmdbTotal <= 0) return { ok: true, missing: 0, reason: 'tmdb-vacío' };
  if (missing === 0) return { ok: true, missing: 0, reason: 'ok' };
  if (missing <= ABS_MIN_MISSING) return { ok: true, missing, reason: 'margen-absoluto' };
  const failAt = Math.ceil(tmdbTotal * (1 - TOLERANCE));
  return { ok: dbRows >= failAt, missing, reason: dbRows >= failAt ? 'ok' : 'falta-más-del-5%' };
}

export function estimateDbSizeMB(rows) {
  return (rows * BYTES_PER_ROW) / (1024 * 1024);
}

// ---------------------------------------------------------------------------
// Llamadas (solo con token / solo con base)
// ---------------------------------------------------------------------------
async function tmdbTotalResults(mediaType, params) {
  const qs = new URLSearchParams({ ...params, page: '1', include_adult: 'false', language: 'es-ES' });
  const res = await fetch(`${TMDB}/discover/${mediaType}?${qs}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB ${mediaType} ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.total_results ?? 0;
}

async function countRows({ col, val }) {
  const qs = new URLSearchParams({ select: 'tmdb_id', [col]: `cs.${val}`, limit: '1' });
  const res = await fetch(`${SUPA_URL}/rest/v1/catalog_titles?${qs}`, {
    headers: {
      apikey: SUPA_KEY,
      authorization: `Bearer ${SUPA_KEY}`,
      prefer: 'count=exact',
    },
  });
  if (!res.ok) throw new Error(`PostgREST ${col} ${res.status}: ${await res.text()}`);
  const cr = res.headers.get('content-range') ?? '';
  // "0-0/1234" → total 1234
  const total = Number(cr.split('/')[1] ?? 0);
  await res.arrayBuffer();
  return Number.isFinite(total) ? total : 0;
}

async function countAny() {
  const res = await fetch(`${SUPA_URL}/rest/v1/catalog_titles?select=tmdb_id&limit=1`, {
    headers: { apikey: SUPA_KEY, authorization: `Bearer ${SUPA_KEY}`, prefer: 'count=exact' },
  });
  if (!res.ok) throw new Error(`PostgREST count ${res.status}`);
  const total = Number((res.headers.get('content-range') ?? '').split('/')[1] ?? 0);
  await res.arrayBuffer();
  return Number.isFinite(total) ? total : 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const providers = loadProviders();
  console.log(`proveedores ES verificados: ${providers.map((p) => p.id).join(', ')}`);

  if (TOKEN && !SUPA_URL) {
    console.error('Falta SUPABASE_URL (o --url=) para contar filas.');
    process.exit(2);
  }
  if (!TOKEN) {
    console.log('⚠ Sin TMDB_READ_TOKEN: no se puede comparar contra TMDB (solo se cuentan filas si hay base).');
  }

  const rows = [];
  let failures = 0;
  for (const p of providers) {
    for (const mediaType of ['movie', 'tv']) {
      for (const monetization of ['flatrate', 'rent|buy']) {
        const label = `${p.id} · ${mediaType} · ${monetization}`;
        let tmdb = null;
        let db = null;
        if (TOKEN) {
          try {
            const params = {
              watch_region: 'ES',
              with_watch_providers: String(p.tmdbProviderId),
              with_watch_monetization_types: monetization,
              sort_by: 'popularity.desc',
            };
            tmdb = await tmdbTotalResults(mediaType, params);
            await sleep(350); // ritmo respetuoso
          } catch (e) {
            rows.push({ label, tmdb: null, db, error: String(e.message ?? e), ok: false });
            failures += 1;
            continue;
          }
        }
        if (SUPA_URL) {
          try {
            const cols = monetization === 'flatrate'
              ? [`platforms_flatrate`, p.id]
              : null;
            // rent|buy no tiene un solo array: se aproxima con la unión rent+buy
            // contando filas con cs en cualquiera de los dos (or=()).
            if (cols) {
              db = await countRows({ col: cols[0], val: cols[1] });
            } else {
              const qs = new URLSearchParams({
                select: 'tmdb_id',
                or: `(${`platforms_rent=cs.${p.id},platforms_buy=cs.${p.id}`})`,
                limit: '1',
              });
              const res = await fetch(`${SUPA_URL}/rest/v1/catalog_titles?${qs}`, {
                headers: { apikey: SUPA_KEY, authorization: `Bearer ${SUPA_KEY}`, prefer: 'count=exact' },
              });
              if (!res.ok) throw new Error(`PostgREST or ${res.status}`);
              db = Number((res.headers.get('content-range') ?? '').split('/')[1] ?? 0);
              await res.arrayBuffer();
            }
          } catch (e) {
            db = null;
            rows.push({ label, tmdb, db: null, error: String(e.message ?? e), ok: false });
            failures += 1;
            continue;
          }
        }
        if (tmdb !== null && db !== null) {
          const v = coverageVerdict(tmdb, db);
          rows.push({ label, tmdb, db, missing: v.missing, reason: v.reason, ok: v.ok });
          if (!v.ok) failures += 1;
        } else {
          rows.push({ label, tmdb, db, reason: 'sin-datos', ok: true });
        }
      }
    }
  }

  // Tabla
  console.log('\nproveedor·tipo·monetización | TMDB | base | faltan | estado');
  for (const r of rows) {
    const tmdb = r.tmdb === null ? '—' : String(r.tmdb);
    const db = r.db === null ? '—' : String(r.db);
    const missing = r.missing === undefined ? '—' : String(r.missing);
    const estado = r.error ? `ERROR ${r.error}` : r.ok ? (r.reason === 'ok' ? 'OK' : `OK (${r.reason})`) : `FALLA (${r.reason})`;
    console.log(`${r.label} | ${tmdb} | ${db} | ${missing} | ${estado}`);
  }

  // Tamaño estimado
  if (SUPA_URL) {
    try {
      const total = await countAny();
      const mb = estimateDbSizeMB(total);
      const pct = (mb / DB_LIMIT_MB) * 100;
      console.log(`\nfilas catalog_titles: ${total} · estimado ${mb.toFixed(1)} MB (${pct.toFixed(1)} % del límite de ${DB_LIMIT_MB} MB)`);
    } catch (e) {
      console.error(`No se pudo contar filas: ${e.message ?? e}`);
    }
  } else if (TOKEN) {
    console.log('\n(sin SUPABASE_URL no se estimó el tamaño de base)');
  }

  if (failures > 0) {
    console.error(`\n✗ ${failures} comprobaciones fallidas.`);
    process.exit(1);
  }
  console.log('\n✓ Cobertura dentro de la tolerancia (o sin token/bases: sin comprobación).');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
