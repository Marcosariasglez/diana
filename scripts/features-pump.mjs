#!/usr/bin/env node
// scripts/features-pump.mjs (fase A, A.5): BOMBA LOCAL de generación de
// features. Llama a la Edge Function `catalog-features` de producción en bucle
// mientras `remaining > 0`, con pausa de 3 s entre llamadas (la función ya
// tiene su propio presupuesto de ~2 min). REANUDABLE: el anti-join es la
// fuente de verdad, así que si se corta, se relanza y continúa.
//
// Uso (desde diana-tmp):
//   node scripts/features-pump.mjs
// Necesita en .env.local: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
// y CATALOG_FEATURES_SECRET (o CATALOG_SYNC_SECRET). NUNCA imprime las claves.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.split('=')[0], l.split('=').slice(1).join('=')]),
);
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secret = env.CATALOG_FEATURES_SECRET || env.CATALOG_SYNC_SECRET;
if (!base || !anon || !secret) {
  console.error('Falta SUPABASE_URL, SUPABASE_ANON_KEY o CATALOG_FEATURES_SECRET en .env.local');
  process.exit(1);
}
const url = `${base}/functions/v1/catalog-features`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let i = 1; i <= 20000; i++) {
  let body = null;
  let code = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'x-catalog-sync-secret': secret,
          'Content-Type': 'application/json',
        },
        // Presupuesto ajustado al plan gratuito: con 40/120 s y 20/90 s la
        // worker era matada a 546 (wall-clock/memoria; los upserts previos SÍ
        // persistían, pero se perdía el tiempo en reintentos). 10/60 s cabe.
        body: '{"maxTitles":10,"timeMs":60000}',
      });
      code = res.status;
      if (code === 200) {
        body = await res.json();
        break;
      }
      if (code === 401 || code === 403 || code === 422) {
        console.error(`HTTP ${code} (error real): ${JSON.stringify(await res.json()).slice(0, 300)}`);
        process.exit(1);
      }
      console.log(`iteración ${i}: HTTP ${code} (infraestructura), reintento ${attempt}/5 en ${30 * attempt} s`);
      await sleep(30000 * attempt);
    } catch (e) {
      console.log(`iteración ${i}: red (${e?.message ?? e}), reintento ${attempt}/5 en ${30 * attempt} s`);
      await sleep(30000 * attempt);
    }
  }
  if (!body) {
    console.error(`iteración ${i}: 5 reintentos fallidos; me detengo (relanzar para continuar).`);
    process.exit(1);
  }
  const ts = new Date().toISOString().slice(11, 19);
  console.log(
    `[${ts}] iteración ${i}: processed=${body.processed} embedded=${body.embedded} fallback=${body.fallback} errors=${body.errors} remaining=${body.remaining}`,
  );
  if (body.remaining === 0) {
    console.log('FEATURES COMPLETAS: catálogo entero embebido.');
    break;
  }
  // Pausa larga: el worker del plan gratuito tardía en «enfriarse»; evitar
  // llamadas sobre un worker medio-muerto (546).
  await sleep(8000);
}
