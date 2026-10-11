#!/usr/bin/env node
// scripts/sql-recommend-scale.mjs: test de ESCALA de recommend() (VERTICE-PLAN-2,
// fase B). Arranca un Postgres+pgvector efímero, aplica TODAS las migraciones
// (el estado actual de producción) y corre scripts/sql-recommend-scale.sql
// (~33.000 candidatos con embedding + 208 valoraciones, la escala de la base
// real) con EXPLAIN ANALYZE para ver el cuello de botella real.
//
// NO es la batería de tests: es diagnóstico de performance. Uso:
//   node scripts/sql-recommend-scale.mjs [--keep]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = process.argv.includes('--keep');
const IMAGE = process.env.DIANA_PG_IMAGE ?? 'pgvector/pgvector:pg16';
const NAME = `diana-recommend-scale-${Date.now().toString(36)}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sh(cmd, args, timeoutMs = 180_000) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs });
  if (r.error) {
    console.error(`✗ ${cmd} ${args.join(' ')}: ${r.error.message}`);
    process.exit(1);
  }
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function docker(args, timeoutMs) {
  return sh('docker', args, timeoutMs);
}

function fail(msg) {
  console.error(msg);
  if (!KEEP) docker(['rm', '-f', NAME]);
  process.exit(1);
}

const probe = docker(['image', 'inspect', IMAGE]);
if (probe.status !== 0) {
  console.log(`→ pull ${IMAGE} (puede tardar un par de minutos)…`);
  const pull = docker(['image', 'pull', IMAGE], 600_000);
  if (pull.status !== 0) fail(`✗ no se pudo pullar ${IMAGE}\n${pull.out}`);
}

const run = docker(['run', '-d', '--name', NAME, '-e', 'POSTGRES_PASSWORD=postgres', IMAGE]);
if (run.status !== 0) fail(`✗ docker run:\n${run.out}`);
console.log(`✓ contenedor ${NAME} arrancado`);

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = docker(['exec', NAME, 'pg_isready', '-U', 'postgres', '-q']);
    if (r.status === 0) { ready = true; break; }
    sh('node', ['-e', 'setTimeout(()=>{},1000)']);
  }
  if (!ready) fail('✗ Postgres no quedó listo en 60 s');
  console.log('✓ postgres listo');

  const files = [
    'scripts/sql-recommend-setup.sql',
    'supabase/migrations/0001_schema.sql',
    'supabase/migrations/0002_rls.sql',
    'supabase/migrations/0003_rpc.sql',
    'supabase/migrations/0005_delete_user_data.sql',
    'supabase/migrations/0006_catalogo.sql',
    'supabase/migrations/0007_recomendador.sql',
    'supabase/migrations/0008_watchlist.sql',
    'supabase/migrations/0009_delete_user_data_watchlist.sql',
    'supabase/migrations/0011_features_rpc.sql',
    'supabase/migrations/0012_room_affinity.sql',
    'supabase/migrations/0013_recommend_perf.sql',
    'supabase/migrations/0014_features_stub_fix.sql',
    'supabase/migrations/0015_recommend_seen.sql',
    'supabase/migrations/0016_recommend_explain_topn.sql',
    'supabase/migrations/0017_recommend_joins.sql',
    'supabase/migrations/0018_recommend_ann.sql',
    'supabase/migrations/0019_recommend_seen_fix.sql',
    'supabase/migrations/0020_recommend_taste_fix.sql',
    'supabase/migrations/0021_recommend_plpgsql_branch.sql',
    'scripts/sql-recommend-scale.sql',
  ];
  for (const f of files) {
    const r = docker(['cp', path.join(root, f), `${NAME}:/tmp/${path.basename(f)}`]);
    if (r.status !== 0) fail(`✗ docker cp ${f}:\n${r.out}`);
  }
  console.log('✓ scripts copiados al contenedor');

  for (const f of files.slice(0, -1)) {
    const r = docker([
      'exec', '-e', 'PGPASSWORD=postgres', NAME,
      'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-q', `-f`, `/tmp/${path.basename(f)}`,
    ], 600_000);
    if (r.status !== 0) fail(`✗ psql ${f}:\n${r.out}`);
    console.log(`✓ psql ${path.basename(f)}`);
  }

  // El SQL de escala (datos + EXPLAIN ANALYZE); imprimimos el plan.
  const t = docker([
    'exec', '-e', 'PGPASSWORD=postgres', NAME,
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', `-f`, '/tmp/sql-recommend-scale.sql',
  ], 900_000);
  console.log(t.out.trim());
  if (t.status !== 0) fail(`✗ sql-recommend-scale.sql falló\n${t.out}`);
} finally {
  if (!KEEP) {
    docker(['rm', '-f', NAME]);
    console.log(`✓ contenedor ${NAME} destruido`);
  } else {
    console.log(`⚠ --keep: contenedor ${NAME} sigue vivo (docker exec -it ${NAME} psql -U postgres)`);
  }
}
