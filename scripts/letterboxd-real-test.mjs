#!/usr/bin/env node
// scripts/letterboxd-real-test.mjs (fase B, B.1/B.3): prueba el FLUJO REAL de
// importación Letterboxd contra SUPABASE Y TMDB DE PRODUCCIÓN, con el código
// REAL de la app (src/services/tmdb/import.repository.ts, cargado por
// transpilación con stubs de los módulos de React Native).
//
// Sin --file: genera un export sintético a partir del catálogo REAL
// (catalog_titles, solo títulos reales): 300 ratings (200 con el título del
// catálogo + 100 con el título ORIGINAL, nota B.2) + 200 watched (sin
// solapes). Lo guarda en docs/vertice/plan2/btest-export/ para re-ejecutar
// el test con la caché match: CALIENTE (--file=) → tasa real sin 429.
// Con --file=C:\ruta\export.zip (o .csv): usa el export REAL del dueño.
//
// Pasos:
//   1. Crea un USUARIO TEMPORAL en auth.users (service_role; el trigger
//      handle_new_user crea su perfil) y genera su JWT (GoTrue admin).
//   2. Ejecuta tmdbImportRepository.parseLetterboxd (.csv suelto y .zip) →
//      cruza contra TMDB real vía la función `tmdb` (rate-limit por usuario).
//   3. Escribe el resultado como lo haría la app (upsert en history_entries
//      con source='letterboxd' + watched) y mide las tasas (B.1).
//   4. (B.3) Verifica que el RPC `recommend` (security invoker) no devuelve
//      títulos ya vistos/valorados importados y que `predict_tenths` responde.
//   5. LIMPIEZA: delete_user_data + borrado de auth.users (verificado).
//
// Uso: node scripts/letterboxd-real-test.mjs [--file=C:\ruta\export.zip] [--keep]
//   --keep: no limpia al final (inspección a mano; se imprime el id).
//
// NOTA (B.2): el cruce solo busca PELÍCULA en TMDB (acción `match` de la
// función tmdb: /search/movie), y el catálogo de producción tampoco tiene
// series (catalog-sync sincroniza solo película). Con caché FRÍA los 429 de
// TMDB pueden anular «coincidencias» (mapLimit traga el error): la tasa
// REAL se mide con la caché CALIENTE (--file= sobre el export guardado).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// .env.local → process.env (sin imprimir valores).
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  process.env[line.slice(0, i)] = line.slice(i + 1);
}
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL / ANON / SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Carga del código REAL de la app por transpilación (mismo patrón que
// eval-recomendador.mjs), con stubs de los módulos de React Native/expo.
// ---------------------------------------------------------------------------
const ts = require(join(root, 'node_modules', 'typescript'));
const tsCache = new Map();
function resolveTs(p) {
  for (const cand of [p, `${p}.ts`, `${p}.tsx`, `${p}.js`, join(p, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

// Sesión del usuario temporal (se rellena en el paso 1); el stub de
// @/lib/supabase crea el cliente con ESA sesión para que invoke('tmdb') y los
// RPCs corran como el usuario (security invoker ve auth.uid() = el temporal).
let userToken = null;
let sharedUserClient = null;
const supabaseJs = require(join(root, 'node_modules', '@supabase', 'supabase-js'));
const adminClient = supabaseJs.createClient(SUPABASE_URL, SERVICE);

const STUBS = {
  'react-native': {
    Platform: { OS: 'web', select: (o) => (o ? o.default : null) },
    StyleSheet: { create: (s) => s, flatten: (s) => s },
  },
  'expo-file-system': { File: class File { constructor(uri) { this.uri = uri; } } },
  '@react-native-async-storage/async-storage': {
    default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
  },
  '@/lib/supabase': {
    // Cliente COMPARTIDO con sesión REAL (setSession AWAITED antes de usarlo):
    // el getSupabase de la app es síncrono; aquí se prepara antes para que
    // functions.invoke('tmdb') lleve el JWT desde la primera llamada.
    getSupabase: () => sharedUserClient,
  },
  // Stores con estado de USUARIO NUEVO (el temporal no tiene historial): evita
  // cargar la cadena de React Native (zustand/AsyncStorage/@services) en Node.
  // El matching del import solo usa profile.id/initialRatings y entries/watched
  // vacíos → comportamiento idéntico al caso real de primer import.
  '@/store/useHistoryStore': { useHistoryStore: { getState: () => ({ entries: [], watched: [] }) } },
  '@/store/useProfileStore': {
    useProfileStore: { getState: () => ({ profile: { id: 'b-test', displayName: 'B-test', initialRatings: {} } }) },
  },
};

function loadTs(absPath, fromDir) {
  if (tsCache.has(absPath)) return tsCache.get(absPath);
  const src = readFileSync(absPath, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const m = { exports: {} };
  tsCache.set(absPath, m.exports);
  const localRequire = (spec) => {
    if (Object.prototype.hasOwnProperty.call(STUBS, spec)) return STUBS[spec];
    // Subrutas de RN/expo (p. ej. 'react-native/Libraries/…'): proxy genérico
    // sin efectos (el código de la app que se carga no las toca en web).
    if (/^(react-native|@react-native|expo-)/.test(spec)) {
      const anyStub = new Proxy(function () {}, {
        get: (t, k) => (k === '__esModule' ? true : k === Symbol.toPrimitive ? () => '' : anyStub),
        apply: () => anyStub,
        construct: () => anyStub,
      });
      return anyStub;
    }
    const abs = spec.startsWith('@/')
      ? join(root, 'src', spec.slice(2))
      : spec.startsWith('.')
        ? join(fromDir, spec)
        : null;
    if (abs) {
      const file = resolveTs(abs);
      if (file) return loadTs(file, dirname(file));
    }
    return require(spec); // jszip, papaparse, zustand, …
  };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', 'console', out.outputText)(m, m.exports, localRequire, console);
  return m.exports;
}
const { tmdbImportRepository } = loadTs(
  join(root, 'src', 'services', 'tmdb', 'import.repository.ts'),
  join(root, 'src', 'services', 'tmdb'),
);

// ---------------------------------------------------------------------------
// 1) Usuario temporal
// ---------------------------------------------------------------------------
const argFile = (() => {
  // Acepta '--file=C:\ruta' (un solo argumento) y '--file C:\ruta' (dos).
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--file=')) return a.slice('--file='.length);
    if (a === '--file' && process.argv[i + 1]) return process.argv[i + 1];
  }
  return null;
})();
const KEEP = process.argv.includes('--keep');
const email = `diana-btest-${randomBytes(6).toString('hex')}@ejemplo.com`;
// Usuario temporal (mismo patrón que scripts/rls-check.mjs): la API de
// administración de GoTrue con service_role (auth.users NO está expuesta en
// PostgREST); el trigger handle_new_user crea el perfil. La contraseña es
// aleatoria y solo vive en memoria.
const password = `Tmp-${Date.now()}-xK9!`;
let userId;
{
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: 'B-test' } });
  if (error) throw new Error(`GoTrue createUser: ${error.message}`);
  userId = data.user.id;
  // Sesión REAL del usuario (JWT de GoTrue): con ella corren invoke('tmdb') y
  // los RPCs security invoker (auth.uid() = el usuario temporal).
  // signInWithPassword devuelve data = { user, session } (los tokens están
  // en data.session, NO en data: con data.access_token salía undefined →
  // invoke sin JWT → 401 → 'read-failed').
  const { data: sdata, error: e2 } = await adminClient.auth.signInWithPassword({ email, password });
  if (e2 || !sdata?.session?.access_token) throw new Error(`signInWithPassword: ${e2?.message ?? 'sin sesión'}`);
  userToken = sdata.session.access_token;
  // setSession AWAITED (con el refresh_token REAL de la sesión): sin esperar,
  // invoke('tmdb') saldría con la anon key (401) y el import fallaría con
  // 'read-failed'. Con autoRefreshToken:false no refresca; el JWT de GoTrue
  // dura horas, suficiente para el test.
  sharedUserClient = supabaseJs.createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: sessErr } = await sharedUserClient.auth.setSession({ access_token: userToken, refresh_token: sdata.session.refresh_token });
  if (sessErr) throw new Error(`setSession: ${sessErr.message}`);
}
console.log(`Usuario temporal: ${email} (id ${userId})`);
if (KEEP) console.log('⚠️ --keep: NO se limpia al final; borrar a mano con el id de arriba.');

// Cliente autenticado como el usuario (para los RPC de B.3): el compartido,
// cuya sesión ya está montada (setSession awaitado arriba).
const userClient = sharedUserClient;

// ---------------------------------------------------------------------------
// 2) Export: real (del dueño) o sintético generado del catálogo REAL
// ---------------------------------------------------------------------------
function csvField(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function ratingsCsv(rows) {
  return ['Date,Name,Year,Link,Rating', ...rows.map((r) => [r.date, csvField(r.name), r.year, 'https://boxd.it/x', r.rating].join(','))].join('\n');
}
function watchedCsv(rows) {
  return ['Date,Name,Year,Link', ...rows.map((r) => [r.date, csvField(r.name), r.year, 'https://boxd.it/x'].join(','))].join('\n');
}
const toDataUri = (text) => `data:text/csv;base64,${Buffer.from(text).toString('base64')}`;
async function zipUri(entries) {
  const JSZip = require(join(root, 'node_modules', 'jszip'));
  const zip = new JSZip();
  for (const [n, t] of Object.entries(entries)) zip.file(n, t);
  const b64 = await zip.generateAsync({ type: 'base64' });
  return `data:application/zip;base64,${b64}`;
}

// Escribe el resultado como lo haría la app (saveImport: upsert por lotes).
async function persistResult(result) {
  const rows = result.entries.map((e) => ({
    user_id: userId,
    key: e.key,
    media_type: e.ref.mediaType,
    media_id: e.ref.mediaId,
    season: null,
    episode: null,
    title: e.title,
    genre_ids: e.genreIds ?? [],
    user_rating: e.userRating,
    ai_prediction_tenths: Math.round(e.aiPrediction * 10),
    prediction_seen: false,
    source: 'letterboxd',
    rated_at: e.ratedAt,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await adminClient.from('history_entries').upsert(rows.slice(i, i + 500), { onConflict: 'user_id,key', ignoreDuplicates: true });
    if (error) throw new Error(`history_entries: ${error.message}`);
  }
  for (let i = 0; i < result.watched.length; i += 500) {
    const chunk = result.watched.slice(i, i + 500).map((key) => ({ user_id: userId, key }));
    const { error } = await adminClient.from('watched').upsert(chunk, { onConflict: 'user_id,key', ignoreDuplicates: true });
    if (error) throw new Error(`watched: ${error.message}`);
  }
}

function reportResult(label, result, totalRows, rowsByType) {
  const matched = result.matched + result.watchedOnlyMatched;
  const rate = totalRows ? ((matched / totalRows) * 100).toFixed(1) : '?';
  console.log(`\n=== ${label} ===`);
  console.log(
    `filas: ${totalRows} | coincidentes: ${matched} (${rate} %) | notas: ${result.matched} | vistas sin nota: ${result.watchedOnlyMatched} | sin coincidencia: ${result.unmatched} | ya presentes: ${result.alreadyPresent}`,
  );
  if (rowsByType) {
    const tvNote = rowsByType.tv ? ' (el cruce solo busca película: las series no coinciden — nota B.2)' : '';
    console.log(`  · películas: ${rowsByType.movie ?? 0} filas · series: ${rowsByType.tv ?? 0} filas${tvNote}`);
  }
  // Resumen tal cual lo ve el usuario (mismo formato que profileLogic.importSummary).
  const summary =
    `Importadas ${result.matched} pel${result.matched === 1 ? '' : 'í'}culas` +
    (result.watchedOnlyMatched ? ` y ${result.watchedOnlyMatched} vistas sin nota` : '') +
    (result.unmatched ? ` · sin coincidencia ${result.unmatched}` : '');
  console.log(`resumen de usuario: «${summary}»`);
}

let zipResult = null;
let zipTotal = 0;
let zipByType = null;

if (argFile) {
  if (!existsSync(argFile)) {
    console.error(`--file no existe: ${argFile}`);
    process.exit(1);
  }
  console.log(`Export a probar: ${argFile}`);
  const b64 = readFileSync(argFile).toString('base64');
  const mime = argFile.toLowerCase().endsWith('.zip') ? 'application/zip' : 'text/csv';
  const name = argFile.split(/[\\/]/).pop();
  const result = await tmdbImportRepository.parseLetterboxd({ uri: `data:${mime};base64,${b64}`, name });
  // Para el total de filas del fichero, reportResult usa el retorno del repo
  // (totalRows + unmatched + alreadyPresent) cuando no se puede contar líneas
  // fiables (zip binario). En .csv suelto se cuentan las líneas menos cabecera.
  let total = result.totalRows + result.unmatched + result.alreadyPresent;
  if (!argFile.toLowerCase().endsWith('.zip')) {
    const text = readFileSync(argFile, 'latin1');
    total = Math.max(0, (text.match(/\n/g) || []).length - 1);
  } else {
    // En el zip se cuentan las filas REALES de ratings.csv + watched.csv
    // (el retorno del repo no incluye las watched ya valoradas).
    const JSZipR = require(join(root, 'node_modules', 'jszip'));
    const zipR = await JSZipR.loadAsync(readFileSync(argFile));
    const findEntry = (name) => {
      for (const [p, e] of Object.entries(zipR.files)) {
        if (e.dir) continue;
        if (p.split('/').pop()?.toLowerCase() === name) return e;
      }
      return null;
    };
    let n = 0;
    for (const name of ['ratings.csv', 'watched.csv']) {
      const entry = findEntry(name);
      if (entry) n += Math.max(0, ((await entry.async('string')).match(/\n/g) || []).length - 1);
    }
    if (n > 0) total = n;
  }
  reportResult('fichero real', result, total, null);
  await persistResult(result);
  zipResult = result;
  zipTotal = total;
} else {
  console.log('Export sintético generado del catálogo REAL (catalog_titles de producción)');
  // Solo títulos reales: el catálogo tiene «stubs» de la sincronización sin
  // title/year que jamás coincidirían y ensuciarían la tasa. .limit()
  // explícito (el límite por defecto de PostgREST es 1000 filas).
  const { data: pool, error: poolErr } = await adminClient
    .from('catalog_titles')
    .select('tmdb_id,media_type,title,original_title,year')
    .eq('media_type', 'movie')
    .order('popularity', { ascending: false })
    .limit(700);
  if (poolErr) throw new Error(`catalog_titles: ${poolErr.message}`);
  const realPool = pool.filter((t) => t.title?.trim() !== '' && Number.isFinite(t.year));
  // Tres pools sin solapes (por tmdb_id):
  //  · movies: 200 con el título del catálogo (camino normal).
  //  · moviesOrig: 100 con el título ORIGINAL (cuando difiere) — el camino
  //    «títulos originales» de B.2 (los exports de Letterboxd de peli
  //    extranjera suelen llevar el original).
  //  · watched: 200 que no están en los otros dos — «vistas sin nota».
  const movies = realPool.slice(0, 200);
  const movieIds = new Set(movies.map((t) => t.tmdb_id));
  const moviesOrig = realPool
    .filter((t) => !movieIds.has(t.tmdb_id) && t.original_title?.trim() && t.original_title.trim() !== t.title.trim())
    .slice(0, 100);
  const usedIds = new Set([...movieIds, ...moviesOrig.map((t) => t.tmdb_id)]);
  const watchedMovies = realPool.filter((t) => !usedIds.has(t.tmdb_id)).slice(0, 200);
  const rnd = (n) => Math.floor(Math.random() * n);
  const dateOf = () => `20${20 + rnd(6)}-${1 + rnd(12)}-${1 + rnd(28)}`;
  const ratingOf = () => String(0.5 + Math.floor(Math.random() * 10) * 0.5);
  const ratingsRows = [
    ...movies.map((t) => ({ date: dateOf(), name: t.title, year: t.year, rating: ratingOf() })),
    ...moviesOrig.map((t) => ({ date: dateOf(), name: t.original_title, year: t.year, rating: ratingOf() })),
  ];
  const watchedRows = watchedMovies.map((t) => ({ date: dateOf(), name: t.title, year: t.year }));
  const ratingsText = ratingsCsv(ratingsRows);
  const watchedText = watchedCsv(watchedRows);

  // Se guarda el export: permite re-ejecutar el test con la caché match:
  // CALIENTE (sin 429 de TMDB) → la tasa de coincidencia REAL (B.2).
  const outDir = join(root, 'docs', 'vertice', 'plan2', 'btest-export');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'ratings.csv'), ratingsText);
  writeFileSync(join(outDir, 'watched.csv'), watchedText);
  const JSZipOut = require(join(root, 'node_modules', 'jszip'));
  const zipOut = new JSZipOut();
  zipOut.file('ratings.csv', ratingsText);
  zipOut.file('watched.csv', watchedText);
  writeFileSync(join(outDir, 'letterboxd-export.zip'), await zipOut.generateAsync({ type: 'nodebuffer' }));
  console.log(`Export guardado: ${outDir}`);
  console.log(`Re-paso cálido (tasa real): node scripts/letterboxd-real-test.mjs --file=${join(outDir, 'letterboxd-export.zip')}`);

  // (a) .csv suelto (solo ratings) — el flujo mínimo del prompt.
  const rCsv = await tmdbImportRepository.parseLetterboxd({ uri: toDataUri(ratingsText), name: 'ratings.csv' });
  reportResult('ratings.csv (suelto) [caché FRÍA]', rCsv, ratingsRows.length, null);

  // (b) .zip con ratings + watched — el flujo completo del prompt.
  const result = await tmdbImportRepository.parseLetterboxd({ uri: await zipUri({ 'ratings.csv': ratingsText, 'watched.csv': watchedText }), name: 'letterboxd-export.zip' });
  reportResult('export.zip (ratings+watched) [caché FRÍA]', result, ratingsRows.length + watchedRows.length, {
    movie: movies.length + moviesOrig.length + watchedMovies.length,
    tv: 0,
  });
  zipResult = result;
  zipTotal = ratingsRows.length + watchedRows.length;
  zipByType = { movie: movies.length + moviesOrig.length + watchedMovies.length, tv: 0 };
  await persistResult(result);
}

// ---------------------------------------------------------------------------
// 3) B.3: el resultado alimenta history_entries (source='letterboxd') y el
//    recomendador y el «ya visto» lo respetan.
// ---------------------------------------------------------------------------
{
  const { count: nRatings } = await adminClient
    .from('history_entries')
    .select('key', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'letterboxd');
  const { count: nWatched } = await adminClient.from('watched').select('key', { count: 'exact', head: true }).eq('user_id', userId);
  console.log(`\n=== B.3 · persistencia y respeto en el recomendador ===`);
  console.log(`history_entries source=letterboxd: ${nRatings} | watched: ${nWatched}`);

  // Recomendador: el RPC (security invoker, como el usuario temporal) NO debe
  // devolver títulos ya vistos/valorados importados.
  const { data: rec, error: recErr } = await userClient.rpc('recommend', { p_platforms: ['netflix'], p_limit: 50, p_offset: 0 });
  if (recErr) {
    console.log(`recommend: ERROR (${recErr.message}) → se verifica solo el «ya visto» por watched`);
  } else {
    const imported = new Set(
      (zipResult ? [...zipResult.entries.map((e) => e.key), ...zipResult.watched] : []).map((k) => k),
    );
    const overlap = (rec ?? []).filter((r) => imported.has(`${r.media_type}:${r.tmdb_id}`));
    console.log(`recommend devolvió ${rec?.length ?? 0} candidatos; solapados con importados: ${overlap.length} (debe ser 0)`);
  }
  // predict_tenths sobre uno de los títulos importados (con nota o watched).
  const anyKey = zipResult?.entries[0]?.key ?? zipResult?.watched[0];
  if (anyKey) {
    const [type, id] = anyKey.split(':');
    const { data: tenths, error: tErr } = await userClient.rpc('predict_tenths', { p_media_type: type, p_tmdb_id: Number(id) });
    console.log(`predict_tenths(${type}:${id}) → ${tErr ? `ERROR (${tErr.message})` : tenths} (esperado smallint 10..50)`);
  }
  void zipByType;
}

// ---------------------------------------------------------------------------
// 4) LIMPIEZA (B.1): borrar todos los datos del usuario temporal.
// ---------------------------------------------------------------------------
async function cleanup() {
  // delete_user_data: con un cliente NUEVO solo de service_role. adminClient
  // NO sirve: tras el signInWithPassword del paso 1 lleva la SESIÓN del
  // usuario temporal y supabase-js la manda como Authorization → PostgREST
  // resuelve el rol `authenticated`, que NO tiene execute sobre el RPC
  // (REVOKE en 0005/0009) → 'permission denied' (el servicio_role SÍ lo
  // tiene por default privileges: verificado con probe).
  const fresh = supabaseJs.createClient(SUPABASE_URL, SERVICE);
  const { error: del } = await fresh.rpc('delete_user_data', { p_target_user_id: userId });
  if (del) console.log(`⚠️ delete_user_data: ${del.message} (revisar a mano)`);
  // El usuario se borra DESPUÉS (su perfil se va con el RPC; el cascade de
  // auth.users solo lo tocaría con everywhere=true, que NO usamos aquí).
  const { error: delUser } = await fresh.auth.admin.deleteUser(userId);
  if (delUser) console.log(`⚠️ GoTrue deleteUser: ${delUser.message} (revisar a mano)`);
  // Espera breve: GoTrue replica la borracha con segundos de lag y una
  // verificación inmediata leería la réplica vieja ('auth.users: 1' falso).
  await new Promise((r) => setTimeout(r, 3000));
  // Verificación.
  const { count: c1 } = await adminClient.from('history_entries').select('key', { count: 'exact', head: true }).eq('user_id', userId);
  const { count: c2 } = await adminClient.from('watched').select('key', { count: 'exact', head: true }).eq('user_id', userId);
  const { count: c3 } = await adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId);
  const { data: gu } = await adminClient.auth.admin.getUserById(userId);
  const c4 = gu ? 1 : 0;
  console.log(`\n=== LIMPIEZA ===`);
  console.log(`history_entries: ${c1} | watched: ${c2} | profiles: ${c3} | auth.users: ${c4} (todo debe ser 0)`);
  if (c1 + c2 + c3 + c4 !== 0) {
    console.log(`⚠️ QUEDAN DATOS del usuario ${userId}: borrar a mano.`);
    process.exitCode = 1;
  } else {
    console.log('Limpieza verificada: 0 filas del usuario temporal.');
  }
}

if (KEEP) {
  console.log('(--keep: sin limpieza)');
} else {
  await cleanup();
}
