/**
 * D5.2: comprueba que la clave `service_role` de Supabase NO aparece en el
 * código de cliente ni en el build de web. Lee el valor desde .env.local
 * (ignorado por git) y busca coincidencias en app/, src/, public/ y dist/
 * sin imprimir nunca el secreto. Sale 1 si se filtra.
 *
 * Uso: node scripts/secret-scan.mjs  (dist/ es opcional: se salta si no existe)
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve();
const envPath = path.join(root, '.env.local');

function readServiceRole() {
  if (!fs.existsSync(envPath)) return null;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\s*=\s*(.+)\s*$/i);
    if (m) {
      const v = m[1].replace(/^["']|["']$/g, '').trim();
      if (v && v.length > 10) return v;
    }
  }
  return null;
}

const secret = readServiceRole();
if (!secret) {
  console.log('AVISO: no se encontró SUPABASE_SERVICE_ROLE_KEY en .env.local; no se puede comprobar el filtrado.');
  process.exit(0);
}

const dirs = ['app', 'src', 'public', 'dist'];
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.mjs', '.cjs', '.map']);
let leaks = 0;
let scanned = 0;

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      walk(full);
    } else if (e.isFile()) {
      if (exts.has(path.extname(e.name)) || e.name === 'index') {
        try {
          const content = fs.readFileSync(full, 'utf8');
          scanned++;
          if (content.includes(secret)) {
            leaks++;
            console.log(`FILTRO: ${path.relative(root, full)}`);
          }
        } catch {
          // binario o no legible: se ignora
        }
      }
    }
  }
}

for (const d of dirs) {
  if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  else if (d === 'dist') console.log('NOTA: dist/ no existe (no se ha hecho build:web); se comprueba en el paso de build.');
}

if (leaks > 0) {
  console.error(`\n✗ service_role aparece en ${leaks} archivo(s). Revisa el listado anterior.`);
  process.exit(1);
}
console.log(`✓ service_role no filtrada: ${scanned} ficheros revisados en [${dirs.filter((d) => fs.existsSync(path.join(root, d))).join(', ')}]`);
process.exit(0);
