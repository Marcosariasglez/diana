#!/usr/bin/env node
/**
 * scripts/catalog-health.mjs — P15/F5-1: auditoría de salud del catálogo.
 *
 * Conecta a Supabase (anon key) y verifica:
 *   - Total de títulos (movie vs tv)
 *   - Cobertura de géneros (genre_ids no vacíos)
 *   - Posters no vacíos (poster_path no null)
 *   - Títulos no vacíos (title != '')
 *   - Runtime pendiente (runtime is null)
 *   - Sin plataformas (flatrate + rent + buy = vacío)
 *
 * DEGRADACIÓN: sin credenciales → imprime advertencia y sale con código 0.
 *
 * Uso:
 *   node scripts/catalog-health.mjs
 *   (lee EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY de .env.local o env)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ---------------------------------------------------------------------------
// Carga de credenciales
// ---------------------------------------------------------------------------
function loadEnv() {
  let url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  let key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  // Intento leer .env.local si no hay en env
  if (!url || !key) {
    try {
      const envPath = join(ROOT, '.env.local');
      const lines = readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^(EXPO_PUBLIC_SUPABASE_URL|SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY)=(.+)$/);
        if (m) {
          if (m[1].includes('URL')) url = m[2].trim();
          if (m[1].includes('ANON_KEY')) key = m[2].trim();
        }
      }
    } catch {
      // Sin .env.local
    }
  }
  return { url: url.replace(/\/$/, ''), key };
}

// ---------------------------------------------------------------------------
// Consulta principal: salud del catálogo en una sola query SQL
// ---------------------------------------------------------------------------
async function queryHealth(supabaseUrl) {
  // Query de salud (equivalente a la SQL de plan-sin-mock.md F5-1)
  const sql = `select
    media_type,
    count(*)::int as total,
    count(*)::int filter (where title = '') as sin_titulo,
    count(*)::int filter (where coalesce(genre_ids, '{}')::text = '{}') as sin_genero,
    count(*)::int filter (where poster_path is null or poster_path = '') as sin_poster,
    count(*)::int filter (where runtime is null) as runtime_pendiente,
    count(*)::int filter (where
      coalesce(platforms_flatrate, '{}')::text = '{}' and
      coalesce(platforms_rent, '{}')::text = '{}' and
      coalesce(platforms_buy, '{}')::text = '{}'
    ) as sin_plataforma
  from public.catalog_titles
  group by 1`;

  // Se envía via rpc (query directa a PostgREST no soporta SQL raw con anon key).
  // Usamos REST directo a /rpc si existe, pero con anon key solo podemos hacer SELECT.
  // Mejor: SELECT con PostgREST y contar en cliente.
  const res = await fetch(`${supabaseUrl}/rest/v1/catalog_titles?select=media_type,title,genre_ids,poster_path,runtime,platforms_flatrate,platforms_rent,platforms_buy`, {
    headers: {
      apikey: loadEnv().key,
      authorization: `Bearer ${loadEnv().key}`,
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
  }

  const rows = await res.json();
  return rows;
}

// ---------------------------------------------------------------------------
// Análisis en cliente
// ---------------------------------------------------------------------------
function analyze(rows) {
  const byType = { movie: {}, series: {} };

  for (const row of rows) {
    const key = row.media_type === 'tv' ? 'series' : 'movie';
    const b = byType[key];
    b.total = (b.total || 0) + 1;
    if (!row.title || row.title === '') b.sin_titulo = (b.sin_titulo || 0) + 1;
    const gid = Array.isArray(row.genre_ids) ? row.genre_ids : [];
    if (gid.length === 0) b.sin_genero = (b.sin_genero || 0) + 1;
    if (!row.poster_path || row.poster_path === '') b.sin_poster = (b.sin_poster || 0) + 1;
    if (row.runtime === null) b.runtime_pendiente = (b.runtime_pendiente || 0) + 1;
    const pf = Array.isArray(row.platforms_flatrate) ? row.platforms_flatrate : [];
    const pr = Array.isArray(row.platforms_rent) ? row.platforms_rent : [];
    const pb = Array.isArray(row.platforms_buy) ? row.platforms_buy : [];
    if (pf.length === 0 && pr.length === 0 && pb.length === 0) b.sin_plataforma = (b.sin_plataforma || 0) + 1;
  }

  return byType;
}

function fmtStats(s) {
  const c = (label, val, warn) => {
    const v = val || 0;
    const icon = warn(v) ? '⚠️' : '✅';
    return `  ${icon} ${label}: ${v}`;
  };
  return `
┌───────────────────────────────────────────────────┐
│ ${s.total.toString().padEnd(39)}│
├───────────────────────────────────────────────────┤
│ ${c('Sin título', s.sin_titulo, (v) => v > 0).padEnd(40)}│
│ ${c('Sin género', s.sin_genero, (v) => v > 0).padEnd(40)}│
│ ${c('Sin poster', s.sin_poster, (v) => v > 0).padEnd(40)}│
│ ${c('Runtime pendiente', s.runtime_pendiente, (v) => v > 0).padEnd(40)}│
│ ${c('Sin plataforma', s.sin_plataforma, (v) => v > 0).padEnd(40)}│
└───────────────────────────────────────────────────┘`.trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { url, key } = loadEnv();

  if (!url || !key) {
    console.log('⚠️  Sin credenciales de Supabase (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).');
    console.log('   No se puede verificar la salud del catálogo.');
    console.log('   (degradación: no bloquea, sale con código 0)');
    process.exit(0);
  }

  console.log(`Conectando a ${url}...`);

  try {
    const rows = await queryHealth(url);
    console.log(`Filas leídas: ${rows.length}`);

    if (rows.length === 0) {
      console.log('⚠️  catalog_titles vacío (0 filas).');
      process.exit(0);
    }

    const result = analyze(rows);
    console.log('\n📊 Salud del catálogo:\n');
    console.log('🎬 Películas:');
    console.log(fmtStats(result.movie));
    console.log('\n📺 Series:');
    console.log(fmtStats(result.series));

    const totalTitles = (result.movie.total || 0) + (result.series.total || 0);
    const totalSinGenero = (result.movie.sin_genero || 0) + (result.series.sin_genero || 0);
    const totalRuntime = (result.movie.runtime_pendiente || 0) + (result.series.runtime_pendiente || 0);

    console.log(`\nTotal: ${totalTitles} títulos`);
    if (totalSinGenero > 0) console.log(`⚠️  ${totalSinGenero} sin género (backfill recomendado)`);
    if (totalRuntime > 0) console.log(`ℹ️  ${totalRuntime} sin runtime (modo 'runtime' de catalog-backfill)`);

    const issues = (result.movie.sin_genero || 0) + (result.series.sin_genero || 0);
    if (issues > (totalTitles * 0.05)) {
      console.log('\n❌ Más del 5% sin género: se recomienda backfill de genre_ids.');
    } else {
      console.log('\n✅ Catálogo sano (géneros ≥ 95%).');
    }
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  }
}

main();
