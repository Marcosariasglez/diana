#!/usr/bin/env node
/**
 * Prueba LOCAL de la migración 0007 (recomendador) contra Postgres + pgvector
 * en un contenedor Docker efímero (VERTICE-PLAN-2, D2-2.2). NO toca
 * producción: el contenedor se crea aquí, se destruye al terminar y no hay
 * proyecto de Supabase de pruebas.
 *
 * Orden de aplicación (misma que haría el dueño en producción, menos 0004
 * realtime que el contenedor no soporta):
 *   scripts/sql-recommend-setup.sql  (stub de auth.uid() + roles anon/authenticated)
 *   supabase/migrations/0001_schema.sql
 *   supabase/migrations/0002_rls.sql
 *   supabase/migrations/0003_rpc.sql
 *   supabase/migrations/0005_delete_user_data.sql
 *   supabase/migrations/0006_catalogo.sql
 *   supabase/migrations/0007_recomendador.sql
 *   scripts/sql-recommend-test.sql   (datos sintéticos + asserts; falla si alguno cae)
 *
 * Uso: node scripts/sql-recommend-local.mjs [--keep]
 *   --keep: no destruir el contenedor al terminar (debug).
 * Imagen: pgvector/pgvector:pg16 por defecto (o $DIANA_PG_IMAGE).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const KEEP = process.argv.includes('--keep');
const IMAGE = process.env.DIANA_PG_IMAGE ?? 'pgvector/pgvector:pg16';
const NAME = `diana-recommend-${Date.now().toString(36)}`;
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

// 1 · Imagen (pull si no existe).
const probe = docker(['image', 'inspect', IMAGE]);
if (probe.status !== 0) {
  console.log(`→ pull ${IMAGE} (puede tardar un par de minutos)…`);
  const pull = docker(['image', 'pull', IMAGE], 600_000);
  if (pull.status !== 0) fail(`✗ no se pudo pullar ${IMAGE}\n${pull.out}`);
}

// 2 · Contenedor efímero.
const run = docker(['run', '-d', '--name', NAME, '-e', 'POSTGRES_PASSWORD=postgres', IMAGE]);
if (run.status !== 0) fail(`✗ docker run:\n${run.out}`);
console.log(`✓ contenedor ${NAME} arrancado`);

try {
  // 3 · Espera a pg_isready.
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = docker(['exec', NAME, 'pg_isready', '-U', 'postgres', '-q']);
    if (r.status === 0) { ready = true; break; }
    sh('node', ['-e', 'setTimeout(()=>{},1000)']);
  }
  if (!ready) fail('✗ Postgres no quedó listo en 60 s');
  console.log('✓ postgres listo');

  // 4 · Copia de los scripts SQL.
  const files = [
    'scripts/sql-recommend-setup.sql',
    'supabase/migrations/0001_schema.sql',
    'supabase/migrations/0002_rls.sql',
    'supabase/migrations/0003_rpc.sql',
    'supabase/migrations/0005_delete_user_data.sql',
    'supabase/migrations/0006_catalogo.sql',
    'supabase/migrations/0007_recomendador.sql',
    'scripts/sql-recommend-test.sql',
  ];
  for (const f of files) {
    const r = docker(['cp', path.join(root, f), `${NAME}:/tmp/${path.basename(f)}`]);
    if (r.status !== 0) fail(`✗ docker cp ${f}:\n${r.out}`);
  }
  console.log('✓ scripts copiados al contenedor');

  // 5 · Setup + migraciones + test, en orden.
  const steps = [
    'sql-recommend-setup.sql',
    '0001_schema.sql',
    '0002_rls.sql',
    '0003_rpc.sql',
    '0005_delete_user_data.sql',
    '0006_catalogo.sql',
    '0007_recomendador.sql',
  ];
  for (const s of steps) {
    const r = docker([
      'exec', '-e', 'PGPASSWORD=postgres', NAME,
      'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-q', `-f`, `/tmp/${s}`,
    ]);
    if (r.status !== 0) {
      fail(`✗ psql ${s}:\n${r.out}`);
    }
    console.log(`✓ psql ${s}`);
  }

  // 6 · El test (los asserts están en el propio SQL; un fallo → exit != 0).
  const t = docker([
    'exec', '-e', 'PGPASSWORD=postgres', NAME,
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', `-f`, '/tmp/sql-recommend-test.sql',
  ]);
  console.log(t.out.trim());
  if (t.status !== 0) fail(`✗ sql-recommend-test.sql falló\n${t.out}`);
  console.log('✓ sql-recommend-test.sql: todos los asserts OK');
} finally {
  if (!KEEP) {
    docker(['rm', '-f', NAME]);
    console.log(`✓ contenedor ${NAME} destruido`);
  } else {
    console.log(`⚠ --keep: contenedor ${NAME} sigue vivo (docker exec -it ${NAME} psql -U postgres)`);
  }
}
