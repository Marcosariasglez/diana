// Prueba de aislamiento (RLS) con dos usuarios reales de prueba. Uso: node scripts/rls-check.mjs
// Lee .env.local: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (la de servicio SOLO en local).
// Crea 2 usuarios temporales, comprueba permisos y los borra. Sale con codigo 1 si algo falla.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
env.SUPABASE_URL ||= env.EXPO_PUBLIC_SUPABASE_URL;
env.SUPABASE_ANON_KEY ||= env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[k]) {
    console.error(`BLOQUEADO: falta ${k} en .env.local`);
    process.exit(2);
  }
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const password = `Tmp-${stamp}-xK9!`;
const users = [];
let failures = 0;

const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
};

async function makeUser(tag) {
  const email = `diana-rls-${tag}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  users.push(data.user.id);
  return { id: data.user.id, client };
}

try {
  const a = await makeUser('a');
  const b = await makeUser('b');
  const c = await makeUser('c');

  // Perfil creado por el trigger.
  const pa = await a.client.from('profiles').select('id').eq('id', a.id);
  check('trigger crea el perfil de A', pa.data?.length === 1);

  // A escribe su historial; B no lo ve ni lo toca.
  const ins = await a.client.from('history_entries').insert({
    user_id: a.id, key: 'movie:1', media_type: 'movie', media_id: 1, title: 'Aftersun',
    user_rating: 4, ai_prediction_tenths: 38, prediction_seen: true,
  });
  check('A inserta su entrada', !ins.error, ins.error?.message);
  const rb = await b.client.from('history_entries').select('key').eq('user_id', a.id);
  check('B no lee el historial de A', (rb.data ?? []).length === 0);
  const ub = await b.client.from('history_entries').update({ user_rating: 1 }).eq('user_id', a.id).select();
  check('B no modifica el historial de A', (ub.data ?? []).length === 0);
  const forged = await b.client.from('history_entries').insert({
    user_id: a.id, key: 'movie:2', media_type: 'movie', media_id: 2, title: 'X',
    user_rating: 3, ai_prediction_tenths: 30,
  });
  check('B no inserta en nombre de A', !!forged.error);
  const badRating = await a.client.from('history_entries').insert({
    user_id: a.id, key: 'movie:3', media_type: 'movie', media_id: 3, title: 'X',
    user_rating: 3.3, ai_prediction_tenths: 30,
  });
  check('la nota debe ir en pasos de 0,5', !!badRating.error);

  // tmdb_cache y api_hits cerradas a clientes.
  const cache = await a.client.from('tmdb_cache').select('cache_key');
  check('tmdb_cache no es legible por el cliente', (cache.data ?? []).length === 0);
  const hits = await a.client.rpc('bump_api_hits', { p_user: a.id });
  check('bump_api_hits no es llamable por el cliente', !!hits.error);

  // Resto de tablas del usuario: A escribe lo suyo, B no toca nada de A.
  const irA = await a.client.from('initial_ratings').upsert(
    { user_id: a.id, media_id: 100, value: 'like', genre_ids: [1] },
    { onConflict: 'user_id,media_id' },
  );
  check('A inserta initial_ratings', !irA.error, irA.error?.message);
  const irB = await b.client.from('initial_ratings').select('media_id').eq('user_id', a.id);
  check('B no lee initial_ratings de A', (irB.data ?? []).length === 0);
  const irForged = await b.client.from('initial_ratings').upsert(
    { user_id: a.id, media_id: 101, value: 'skip', genre_ids: [] },
    { onConflict: 'user_id,media_id' },
  );
  check('B no inserta initial_ratings en nombre de A', !!irForged.error);

  const wA = await a.client.from('watched').insert({ user_id: a.id, key: 'movie:1' });
  check('A inserta watched', !wA.error, wA.error?.message);
  const wB = await b.client.from('watched').select('key').eq('user_id', a.id);
  check('B no lee watched de A', (wB.data ?? []).length === 0);
  const wForged = await b.client.from('watched').insert({ user_id: a.id, key: 'movie:2' });
  check('B no inserta watched en nombre de A', !!wForged.error);

  const profRead = await a.client.from('profiles').select('display_name').eq('id', a.id).single();
  check('A lee su propio perfil', !profRead.error && typeof profRead.data?.display_name === 'string');
  const profOther = await b.client.from('profiles').select('display_name').eq('id', a.id).single();
  check('B no lee el perfil de A', !!profOther.error);
  const profUpdate = await b.client.from('profiles').update({ display_name: 'hack' }).eq('id', a.id).select();
  check('B no modifica el perfil de A', (profUpdate.data ?? []).length === 0);

  // delete_user_data: RPC security definer REVOKE a public/anon/authenticated.
  const delClient = await a.client.rpc('delete_user_data', { target_user_id: a.id });
  check('delete_user_data no es llamable por el cliente (solo service_role)', !!delClient.error);
  // ...y A sigue intacto tras el intento.
  const profStill = await a.client.from('profiles').select('id').eq('id', a.id).single();
  check('A sigue vivo tras el intento de borrado', !profStill.error);

  // Salas.
  const created = await a.client.rpc('create_room', { p_name: 'Ana' });
  check('A crea sala', !created.error && /^[A-HJ-NP-Z2-9]{4}$/.test(created.data ?? ''), created.error?.message);
  const code = created.data;
  const outsider = await c.client.from('rooms').select('code').eq('code', code);
  check('un no miembro no ve la sala', (outsider.data ?? []).length === 0);
  const direct = await c.client.from('rooms').insert({ code: 'ZZZZ', host_id: c.id });
  check('no se crean salas por insert directo', !!direct.error);
  const bad = await b.client.rpc('join_room', { p_code: 'ZZZZ', p_name: 'Beto' });
  check('unirse a una sala inexistente da not-found', bad.error?.message === 'not-found', bad.error?.message);
  const join = await b.client.rpc('join_room', { p_code: code.toLowerCase(), p_name: 'Beto' });
  check('B se une con el codigo (minusculas)', !join.error, join.error?.message);
  const seen = await b.client.from('rooms').select('code,phase').eq('code', code);
  check('B ve la sala tras unirse', seen.data?.length === 1);
  const notHost = await b.client.rpc('start_match', { p_code: code });
  check('solo el anfitrion empieza (not-host)', notHost.error?.message === 'not-host', notHost.error?.message);
  const start = await a.client.rpc('start_match', { p_code: code });
  check('el anfitrion empieza', !start.error, start.error?.message);
  const early = await a.client.rpc('confirm_mood', { p_code: code, p_deck: [] });
  check('confirmar sin respuestas da mood-incomplete', early.error?.message === 'mood-incomplete', early.error?.message);
  for (const [q, v] of [['time', 'h2'], ['energy', 'calm'], ['company', 'friends'], ['platforms', 'netflix,max']]) {
    const r = await a.client.rpc('set_mood_answer', { p_code: code, p_question: q, p_answer: v });
    if (r.error) check(`respuesta ${q}`, false, r.error.message);
  }
  const confirm = await a.client.rpc('confirm_mood', { p_code: code, p_deck: [{ mediaType: 'movie', mediaId: 1 }] });
  check('el anfitrion confirma con mazo', !confirm.error, confirm.error?.message);
  const dec = await b.client.rpc('submit_decision', { p_code: code, p_key: 'movie:1', p_decision: 'like' });
  check('B decide en fase swipe', !dec.error, dec.error?.message);
  const decC = await c.client.rpc('submit_decision', { p_code: code, p_key: 'movie:1', p_decision: 'like' });
  check('un no miembro no decide', !!decC.error);
  const keys = await b.client.rpc('group_seen_keys', { p_code: code });
  check('group_seen_keys devuelve vistos de A (movie:1)', Array.isArray(keys.data) && keys.data.includes('movie:1'), JSON.stringify(keys.error ?? keys.data));
  const keysC = await c.client.rpc('group_seen_keys', { p_code: code });
  check('un no miembro no llama a group_seen_keys', !!keysC.error);
  const lobby = await a.client.rpc('back_to_lobby', { p_code: code });
  check('el anfitrion vuelve al lobby', !lobby.error, lobby.error?.message);
} catch (e) {
  console.error('ERROR inesperado:', e?.message ?? e);
  failures++;
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

console.log(failures === 0 ? '\nTODO OK: RLS y RPC se comportan como se espera.' : `\n${failures} comprobaciones fallaron.`);
process.exit(failures === 0 ? 0 : 1);
