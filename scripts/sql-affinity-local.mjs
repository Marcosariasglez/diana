#!/usr/bin/env node
/**
 * Prueba LOCAL de la migración 0012 (afinidad de sala, VERTICE-PLAN-2 C.4)
 * contra Postgres en un contenedor Docker efímero. NO toca producción.
 *
 * Orden de aplicación (el mismo que el runner del recomendador):
 *   scripts/sql-recommend-setup.sql  (stub de auth.uid() + roles anon/authenticated)
 *   supabase/migrations/0001_schema.sql
 *   supabase/migrations/0003_rpc.sql
 *   supabase/migrations/0012_room_affinity.sql
 *   scripts/sql-affinity-test.sql    (asserts; falla si alguno cae)
 *
 * Uso: node scripts/sql-affinity-local.mjs [--keep]
 *   --keep: no destruir el contenedor al terminar (debug).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const KEEP = process.argv.includes('--keep');
const IMAGE = process.env.DIANA_PG_IMAGE ?? 'pgvector/pgvector:pg16';
const NAME = `diana-affinity-${Date.now().toString(36)}`;
const root = path.resolve(import.meta.dirname, '..');

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
  console.log(`→ pull ${IMAGE}…`);
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
    'supabase/migrations/0003_rpc.sql',
    'supabase/migrations/0012_room_affinity.sql',
    'scripts/sql-affinity-test.sql',
  ];
  for (const f of files) {
    const r = docker(['cp', path.join(root, f), `${NAME}:/tmp/${path.basename(f)}`]);
    if (r.status !== 0) fail(`✗ docker cp ${f}:\n${r.out}`);
  }
  console.log('✓ scripts copiados al contenedor');

  for (const s of files) {
    const r = docker([
      'exec', '-e', 'PGPASSWORD=postgres', NAME,
      'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-q', `-f`, `/tmp/${path.basename(s)}`,
    ]);
    if (r.status !== 0) fail(`✗ psql ${s}:\n${r.out}`);
    console.log(`✓ psql ${path.basename(s)}`);
  }
} finally {
  if (!KEEP) {
    docker(['rm', '-f', NAME]);
    console.log(`✓ contenedor ${NAME} destruido`);
  } else {
    console.log(`⚠ --keep: contenedor ${NAME} sigue vivo (docker exec -it ${NAME} psql -U postgres)`);
  }
}
