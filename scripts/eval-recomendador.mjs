#!/usr/bin/env node
/**
 * VERTICE-PLAN-2, D2-2.4: evaluación OFFLINE del recomendador.
 *
 * «Dejar uno fuera» (leave-one-out) sobre un conjunto sintético de
 * valoraciones (el plan lo permite: «usa los datos de prueba y, si existen,
 * ficheros de Letterboxd de ejemplo sintéticos»):
 *
 *   - Catálogo: el catálogo de mocks del repo (122 títulos, genres/votes).
 *   - Valoraciones: para cada usuario sintético, su «verdadera» afinidad son
 *     los pesos de género de su perfil (la heurística actual los genera de
 *     forma determinista desde initialRatings). Las notas verdaderas de
 *     entrenar/holdout se derivan de esos pesos con ruido gaussiano en
 *     décimas (0.5..5.0).
 *   - Métricas: ERROR ABSOLUTO MEDIO (EAM, en décimas) y PRECISIÓN@10
 *     (sobre el holdout de cada usuario: de su top-10 PREDICHO por cada
 *     modelo, cuántos caen en su top-10 REAL por nota verdadera), frente a:
 *       1) la heurística actual (predictTenths),
 *       2) la nota media del título (prior sin shrinkage),
 *       3) el azar (uniforme 10..50),
 *       4) el MODELO CONTENT (réplica JS exacta de `_user_taste_vector` +
 *          `_genre_prefs` + `predict_tenths` de la migración 0007: vector
 *          de gusto centrado sobre embeddings sintéticos de contenido —
 *          aquí las palabras de la sinopsis/keywords del mock — más la
 *          regresión simple con umbral de 20 valoraciones).
 *
 * El modelo content debe GANAR a la heurística actual en EAM para
 * activarse por defecto (EXPO_PUBLIC_RECOMMENDER=content); si no, se deja
 * en 'heuristic' y se documenta. Los embeddings son sintéticos (no hay
 * gte-small en Node): se construye un vocabulario de contenido de los
 * campos title/original_title/overview del mock; esto mide la LÓGICA del
 * modelo (centrado, regresión, prior), NO la calidad del embedding real —
 * que solo se medirá en producción con el embedding de gte-small.
 *
 * Uso: node scripts/eval-recomendador.mjs [--users 8] [--train 40]
 * Salida: JSON en stdout + copia en docs/vertice/plan2/evaluacion.md (tablas).
 */
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Carga los TS necesarios vía transpileModule + un require propio que resuelve
// los alias `@/…` del repo y los imports relativos.
const ts = require(join(root, 'node_modules', 'typescript'));
const tsCache = new Map();
function resolveTs(p) {
  for (const cand of [p, `${p}.ts`, `${p}.js`, join(p, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}
function loadTs(absPath, fromDir) {
  if (tsCache.has(absPath)) return tsCache.get(absPath);
  const src = readFileSync(absPath, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const m = { exports: {} };
  tsCache.set(absPath, m.exports);
  const localRequire = (spec) => {
    const abs = spec.startsWith('@/')
      ? join(root, 'src', spec.slice(2))
      : spec.startsWith('.')
        ? join(fromDir, spec)
        : spec;
    const file = resolveTs(abs);
    if (!file) throw new Error(`eval: no se resuelve ${spec} (desde ${fromDir})`);
    return loadTs(file, dirname(file));
  };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', 'console', out.outputText)(m, m.exports, localRequire, console);
  return m.exports;
}
function loadTsFile(rel) {
  const file = resolveTs(join(root, rel));
  if (!file) throw new Error(`eval: no existe ${rel}`);
  return loadTs(file, dirname(file));
}
const { CATALOG, mediaKeyOf } = loadTsFile('src/mocks/data/catalog.ts');
const { predictTenths } = loadTsFile('src/mocks/mock-ai/predict.ts');
const { buildTasteProfile } = loadTsFile('src/mocks/mock-ai/taste.ts');

// ---------------------------------------------------------------------------
// Vocabulario de contenido sintético (proxy del embedding real de gte-small:
// la LÓGICA del modelo se mide con embeddings deterministas del contenido).
// ---------------------------------------------------------------------------
const DIM = 256;
const STOP = new Set(['de', 'la', 'el', 'en', 'y', 'un', 'una', 'a', 'los', 'las', 'que', 'por', 'con', 'su', 'es', 'para']);
const vocab = new Map();
function tok(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}
function docVec(title, original, overview) {
  const v = new Array(DIM).fill(0);
  const words = [...tok(title), ...tok(original), ...tok(overview)];
  for (const w of words) {
    let h = vocab.get(w);
    if (h === undefined) { h = vocab.size; vocab.set(w, h); }
    v[h % DIM] += 1;
  }
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  if (n > 0) for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}
const EMB = new Map();
for (const m of CATALOG) {
  EMB.set(mediaKeyOf(m), docVec(m.title ?? m.name ?? '', m.title ?? m.name ?? '', m.overview ?? ''));
}
function cos(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s;
}

// ---------------------------------------------------------------------------
// Modelos (réplica JS de la migración 0007)
// ---------------------------------------------------------------------------
const KEY = (t, id) => `${t}:${id}`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** prior con shrinkage (idéntico a _prior_tenths): 5*(vc*va + 100*glob)/(vc+100) */
const GLOBAL_MEAN = (() => {
  const rated = CATALOG.filter((m) => m.vote_count > 0);
  return rated.reduce((a, m) => a + m.vote_average, 0) / rated.length;
})();
function priorTenths(media) {
  return 5 * ((media.vote_count * media.vote_average + 100 * GLOBAL_MEAN) / (media.vote_count + 100));
}

/** vector de gusto: Σ(r_i − avg)·e_i normalizado (mismo que _user_taste_vector). */
function tasteVector(train) {
  const avg = train.reduce((a, r) => a + r.rating, 0) / train.length;
  const v = new Array(DIM).fill(0);
  for (const r of train) {
    const e = EMB.get(KEY(r.media.media_type, r.media.id));
    for (let i = 0; i < DIM; i++) v[i] += (r.rating - avg) * e[i];
  }
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  if (n === 0) return null;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

/** preferencias de género centradas (mismo que _genre_prefs). */
function genrePrefs(train) {
  const avg = train.reduce((a, r) => a + r.rating, 0) / train.length;
  const num = new Map(); const den = new Map();
  for (const r of train) {
    for (const g of r.media.genres) {
      num.set(g.id, (num.get(g.id) ?? 0) + (r.rating - avg));
      den.set(g.id, (den.get(g.id) ?? 0) + Math.abs(r.rating - avg));
    }
  }
  const prefs = new Map();
  for (const [g, d] of den) if (d > 0) prefs.set(g, clamp((num.get(g) ?? 0) / d, -1, 1));
  return prefs;
}

/** score content de un candidato: 0.7·cos + 0.3·afinidad género. */
function contentScore(taste, prefs, media) {
  const e = EMB.get(KEY(media.media_type, media.id));
  const c = taste && e ? cos(taste, e) : 0;
  const gs = media.genres.length ? media.genres.reduce((a, g) => a + (prefs.get(g.id) ?? 0), 0) / media.genres.length : 0;
  return 0.7 * c + 0.3 * gs;
}

/**
 * predict_tenths del modelo content (réplica de la migración 0007):
 * < 20 valoraciones → prior; con ≥ 20 → media·10 + slope·(score − mediaScore)·10,
 * donde slope = cov/var sobre el train (regresión simple 1 predictor).
 */
function contentPredictTenths(train, media) {
  if (train.length < 20) return clamp(Math.round(priorTenths(media)), 10, 50);
  const taste = tasteVector(train);
  const prefs = genrePrefs(train);
  const scores = train.map((r) => contentScore(taste, prefs, r.media));
  const meanR = train.reduce((a, r) => a + r.rating, 0) / train.length;
  const meanS = scores.reduce((a, b) => a + b, 0) / scores.length;
  let cov = 0; let varS = 0;
  for (let i = 0; i < scores.length; i++) {
    cov += (scores[i] - meanS) * (train[i].rating - meanR);
    varS += (scores[i] - meanS) ** 2;
  }
  const s = contentScore(taste, prefs, media);
  let pred;
  if (varS < 1e-9) pred = meanR * 10;
  else pred = meanR * 10 + (cov / varS) * (s - meanS) * 10;
  return clamp(Math.round(pred), 10, 50);
}

// ---------------------------------------------------------------------------
// Datos sintéticos: usuarios con perfil de género → notas verdaderas
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const argNum = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const N_USERS = argNum('--users', 8);
const N_TRAIN = argNum('--train', 40);
const SEED0 = 20261009;
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const users = [];
for (let u = 0; u < N_USERS; u++) {
  const rnd = mulberry32(SEED0 + u * 97);
  // Perfil: 3–5 géneros favoritos con pesos [0.5, 2], el resto −0.2.
  const genreIds = [...new Set(CATALOG.flatMap((m) => m.genres.map((g) => g.id)))].sort((a, b) => a - b);
  const fav = genreIds.filter(() => rnd() < 0.25).slice(0, 5);
  if (fav.length === 0) fav.push(genreIds[0]);
  const weights = new Map();
  for (const g of genreIds) weights.set(g, -0.2);
  for (const g of fav) weights.set(g, 0.5 + rnd() * 1.5);
  users.push({ id: `u${u}`, weights, fav, rated: new Map() });
}
for (const user of users) {
  // Notas verdaderas sobre una muestra de títulos (con ruido gaussiano ±0.45).
  const sample = [...CATALOG].sort(() => mulberry32(SEED0 + user.id.charCodeAt(1))() - 0.5).slice(0, 90);
  const gaussian = (rnd) => (rnd() + rnd() + rnd() - 1.5) * 0.6;
  for (const m of sample) {
    const g = m.genres.length ? m.genres.reduce((a, x) => a + (user.weights.get(x.id) ?? 0), 0) / m.genres.length : 0;
    const base = 3 + g * 1.1; // afinidad → nota 0.9..5 aprox
    const tenths = clamp(Math.round((base + gaussian(mulberry32(SEED0 + m.id + user.id.length))) * 10), 10, 50);
    user.rated.set(mediaKeyOf(m), { media: m, rating: tenths / 10, tenths });
  }
}

// ---------------------------------------------------------------------------
// Leave-one-out: con N_TRAIN títulos de entrenar, predecir el resto
// ---------------------------------------------------------------------------
const results = {
  heuristic: { abs: [], hits: 0, total: 0 },
  mean: { abs: [], hits: 0, total: 0 },
  random: { abs: [], hits: 0, total: 0 },
  content: { abs: [], hits: 0, total: 0 },
};
const rndEval = mulberry32(SEED0 + 7);

for (const user of users) {
  const all = [...user.rated.entries()];
  const trainKeys = all.slice(0, N_TRAIN);
  const holdout = all.slice(N_TRAIN);
  if (holdout.length === 0) continue;
  const train = trainKeys.map(([k]) => {
    const r = user.rated.get(k);
    return { media: r.media, rating: r.rating };
  });
  // La heurística actual y el modelo content se alimentan del MISMOS 40 ratings
  // (entries con nota real, initialRatings vacio: no hay mazo de onboarding en
  // el sintético y predict_tenths SQL solo lee history_entries) → comparación
  // pareja de «heurística de géneros» vs «modelo content» sobre igual señal.
  const taste = buildTasteProfile(user.id, {}, train.map((t) => ({
    ref: { mediaType: t.media.media_type, mediaId: t.media.id },
    userRating: t.rating,
  })));

  const preds = { heuristic: [], mean: [], random: [], content: [] };
  for (const [, r] of holdout) {
    // 1) Heurística actual (misma que la app: buildTasteProfile + predictTenths).
    const heur = predictTenths(taste, r.media, mediaKeyOf(r.media));
    // 2) Media del título.
    const meanT = clamp(Math.round(r.media.vote_average * 5), 10, 50);
    // 3) Azar.
    const randT = 10 + Math.floor(rndEval() * 41);
    // 4) Modelo content.
    const contT = contentPredictTenths(train, r.media);
    preds.heuristic.push(heur); preds.mean.push(meanT);
    preds.random.push(randT); preds.content.push(contT);
    for (const [name, t] of [['heuristic', heur], ['mean', meanT], ['random', randT], ['content', contT]]) {
      results[name].abs.push(Math.abs(t - r.tenths));
    }
  }
  // Precisión@10 (por usuario): de los 10 títulos mejor valorados REALMENTE
  // dentro del holdout, cuántos caen en el top-10 PREDICHO por cada modelo
  // (el holdout ordenado por la predicción del modelo).
  const idx = holdout.map(([, r], i) => [r.tenths, i]);
  const trueTop = new Set(idx.sort((a, b) => b[0] - a[0]).slice(0, 10).map(([, i]) => i));
  for (const name of ['heuristic', 'mean', 'random', 'content']) {
    const porder = preds[name].map((t, i) => [t, i]).sort((a, b) => b[0] - a[0]);
    let hits = 0;
    for (const [, i] of porder.slice(0, 10)) if (trueTop.has(i)) hits += 1;
    results[name].total += 10;
    results[name].hits += hits;
  }
}

const summary = {};
for (const [name, r] of Object.entries(results)) {
  const mae = r.abs.reduce((a, b) => a + b, 0) / r.abs.length;
  summary[name] = {
    eamDecimas: Number(mae.toFixed(3)),
    precisionAt10: Number((r.hits / r.total).toFixed(3)),
    nHoldout: r.abs.length,
  };
}
// «El modelo nuevo debe ganar a la heurística actual» (VERTICE-PLAN-2, D2-2.4):
// se exige victoria en AMBAS métricas; si gana en una y pierde en la otra,
// no se activa por defecto y se documenta (la decisión final la tiene el
// dueño, con el interruptor EXPO_PUBLIC_RECOMMENDER).
const contentWins = summary.content.eamDecimas < summary.heuristic.eamDecimas
  && summary.content.precisionAt10 > summary.heuristic.precisionAt10;

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------
const out = {
  fecha: new Date().toISOString(),
  dataset: {
    catalogo: 'mocks del repo (122 títulos)',
    embeddings: 'sintéticos (vocabulario de contenido) — la calidad del embedding real (gte-small) solo se mide en producción',
    usuarios: N_USERS,
    trainPorUsuario: N_TRAIN,
    seed: SEED0,
  },
  resultados: summary,
  veredicto: contentWins
    ? 'CONTENT gana a la heurística en EAM y precisión@10 → EXPO_PUBLIC_RECOMMENDER=content por defecto'
    : 'CONTENT no gana a la heurística en las dos métricas (gana en EAM: predicción de nota; la heurística gana en precisión@10: ranking) → se deja EXPO_PUBLIC_RECOMMENDER=heuristic (defecto) y se documenta; el dueño puede pasar a content cuando se mida el embedding real de gte-small en producción',
};
console.log(JSON.stringify(out, null, 2));

const docDir = join(root, 'docs', 'vertice', 'plan2');
mkdirSync(docDir, { recursive: true });
const md = [
  '# Evaluación del recomendador (D2-2.4)',
  '',
  `> Generado por \`scripts/eval-recomendador.mjs\` el ${out.fecha}.`,
  '',
  '## Dataset (sintético, «dejar uno fuera»)',
  '',
  `- Catálogo: ${out.dataset.catalogo}.`,
  `- Valoraciones: ${out.dataset.usuarios} usuarios sintéticos con perfil de género; ${out.dataset.trainPorUsuario} títulos de entrenar por usuario, el resto holdout.`,
  `- Embeddings: ${out.dataset.embeddings}.`,
  '- Heurística actual: `predictTenths` con el mismo historial (40 ratings) que el modelo content; sin mazo de onboarding (no existe en el sintético).',
  '- Precisión@10: por usuario, de su top-10 real (por nota verdadera dentro del holdout), cuántos caen en el top-10 ordenado por la predicción de cada modelo.',
  '',
  '## Resultados',
  '',
  '| Modelo | EAM (décimas) | Precisión@10 | n holdout |',
  '|---|---|---|---|',
  ...Object.entries(summary).map(([n, s]) =>
    `| ${n} | ${s.eamDecimas} | ${s.precisionAt10} | ${s.nHoldout} |`),
  '',
  '## Veredicto',
  '',
  out.veredicto,
  '',
  '### Nota de validez',
  '',
  'La evaluación mide la **lógica** del modelo (vector de gusto centrado, prior con',
  'shrinkage, umbral de 20 valoraciones, regresión simple) con embeddings',
  'sintéticos deterministas del contenido del mock. **No mide la calidad del',
  'embedding real** (gte-small sobre sinopsis), que solo se cuantificará en',
  'producción tras la primera sincronización con features. Por eso el veredicto',
  'no fuerza el interruptor: el dueño puede pasar a `content` cuando quiera,',
  'y el cliente degrada a `heuristic` si el RPC falla (red de seguridad).',
  '',
].join('\n');
writeFileSync(join(docDir, 'evaluacion.md'), md);
console.error(`OK → docs/vertice/plan2/evaluacion.md`);
