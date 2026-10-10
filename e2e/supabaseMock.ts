/**
 * Mock de las llamadas HTTP de Supabase para la suite E2E (VERTICE-NOCHE D-2).
 *
 * Intercepta con page.route las peticiones que supabase-js hace contra el origen
 * configurado en el build (http://127.0.0.1:4319/e2e-sb) y las responde **con la
 * misma forma que devuelve el servicio real**:
 *
 *  - GoTrue: sesiones `{ access_token, token_type, expires_in, refresh_token,
 *    user: { id, aud, email, app_metadata, identities, ... } }`; errores
 *    `{ error_description, error_code? }`; `/authorize` responde 302 a la
 *    redirect_to con `?code=…` (simula la vuelta de Google, que llega en la
 *    query, no en el hash — lección del plan nocturno).
 *  - PostgREST: JSON con `select`, `eq`, `offset/limit` y `order`; `.single()`
 *    (limit=1) devuelve el objeto o 406 PGRST116; upsert/insert en POST,
 *    update en PATCH, delete en DELETE.
 *  - Edge Functions: `/functions/v1/delete-account` y `/functions/v1/tmdb`.
 *
 * Nada toca producción: todo se resuelve dentro del navegador del test.
 */
import type { Page, Route } from '@playwright/test';
import { E2E_USER, emailUserId, makeJwt } from './constants';

const SB_ORIGIN = /http:\/\/127\.0\.0\.1:4319\/e2e-sb/;

// ---------------------------------------------------------------------------
// Estado del escenario
// ---------------------------------------------------------------------------

export interface E2EState {
  /** Usuario de Google (provider 'google'). */
  googleUser: { id: string; email: string };
  /** true → perfil onbordeado (la entrada lleva a Inicio, no a /welcome). */
  googleOnboarded: boolean;
  /** Usuario de email-OTP del escenario. */
  otpUser?: { email: string; displayName: string; hasOnboarded: boolean };
  /** Código OTP aceptado (6 dígitos). */
  otpCode?: string;
  /** 429 en POST /auth/v1/otp. */
  otpSendFail?: boolean;
  /** 429 en POST /auth/v1/verify. */
  otpVerifyRateLimited?: boolean;
  /** Registro de peticiones (para aserciones). */
  log: { path: string; method: string; body: string; query: string }[];
  /** Cuerpos recibidos por /functions/v1/delete-account. */
  deleteCalls: string[];
  /** Scopes recibidos en /auth/v1/logout. */
  logoutScopes: string[];
}

export function createState(overrides: Partial<E2EState> = {}): E2EState {
  return {
    googleUser: { id: E2E_USER.id, email: E2E_USER.email },
    googleOnboarded: true,
    log: [],
    deleteCalls: [],
    logoutScopes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Facturación de objetos GoTrue
// ---------------------------------------------------------------------------

const b64url = (s: string): string => Buffer.from(s).toString('base64url');

function userObject(s: E2EState, id: string, email: string, provider: 'google' | 'email') {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider, providers: [provider] },
    user_metadata: {},
    identities: [
      {
        id: b64url(`identity-${id}`),
        user_id: id,
        identity_data: { sub: b64url(`ext-${id}`), email },
        provider,
        last_sign_in_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
}

function sessionPayload(s: E2EState, id: string, email: string, provider: 'google' | 'email') {
  return {
    access_token: makeJwt(id),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `e2e-refresh-${id}`,
    scope: 'email',
    user: userObject(s, id, email, provider),
  };
}

/** Sesión del usuario de Google en JSON (para sembrar localStorage directamente). */
export function seededGoogleSession(s: E2EState): string {
  return JSON.stringify(sessionPayload(s, s.googleUser.id, s.googleUser.email, 'google'));
}

/** Resuelve (id, email, provider) del llamante a partir de un JWT. */
function callerFromToken(token: string, s: E2EState): { id: string; email: string; provider: 'google' | 'email' } | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (typeof payload.sub !== 'string') return null;
    if (payload.sub === s.googleUser.id) {
      return { id: payload.sub, email: s.googleUser.email, provider: 'google' };
    }
    if (s.otpUser && payload.sub === emailUserId(s.otpUser.email)) {
      return { id: payload.sub, email: s.otpUser.email, provider: 'email' };
    }
    return { id: payload.sub, email: `${payload.sub}@ejemplo.com`, provider: 'email' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PostgREST: tablas en memoria (misma forma de columnas que 0001_schema.sql)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface Table {
  rows: Row[];
  pk: string[];
}

function makeDb(s: E2EState): Record<string, Table> {
  const profiles: Row[] = [
    {
      id: s.googleUser.id,
      display_name: 'Google E2E',
      favorite_platforms: ['netflix', 'prime-video'],
      favorite_genres: [1, 2],
      has_onboarded: s.googleOnboarded,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  if (s.otpUser) {
    profiles.push({
      id: emailUserId(s.otpUser.email),
      display_name: s.otpUser.displayName,
      favorite_platforms: ['max'],
      favorite_genres: [3],
      has_onboarded: s.otpUser.hasOnboarded,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  return {
    profiles: { rows: profiles, pk: ['id'] },
    initial_ratings: {
      rows: [{ user_id: s.googleUser.id, media_id: 7, value: 'like', genre_ids: [3], created_at: new Date().toISOString() }],
      pk: ['user_id', 'media_id'],
    },
    history_entries: {
      rows: [
        {
          user_id: s.googleUser.id,
          key: 'movie:1',
          media_type: 'movie',
          media_id: 1,
          season: null,
          episode: null,
          title: 'Aftersun',
          user_rating: 5,
          source: 'manual',
          rated_at: new Date().toISOString(),
        },
      ],
      pk: ['user_id', 'key'],
    },
    watched: { rows: [{ user_id: s.googleUser.id, key: 'movie:2', created_at: new Date().toISOString() }], pk: ['user_id', 'key'] },
    rooms: { rows: [], pk: ['code'] },
    room_members: { rows: [], pk: ['code', 'user_id'] },
    room_decisions: { rows: [], pk: ['code', 'user_id', 'key'] },
  };
}

const KNOWN_OPS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'is', 'like', 'ilike', 'cs', 'cd'];

/**
 * Filtros PostgREST usados por Diana. supabase-js genera la forma IMPLÍCITA
 * del operador (en el VALOR): `id=eq.1111...`, `key=in.(a,b)`. También se
 * admite la forma explícita (operador en la CLAVE): `id.eq=1111...`.
 */
function applyFilters(rows: Row[], q: URLSearchParams): Row[] {
  let out = [...rows];
  for (const [k, v] of q.entries()) {
    if (['select', 'order', 'offset', 'limit', 'on_conflict'].includes(k)) continue;
    let col = k;
    let opRaw: string | undefined;
    let val = v;
    const keyParts = k.split('.');
    if (keyParts.length >= 2 && KNOWN_OPS.includes(keyParts[1])) {
      // Forma explícita: col.op=val (o col.op.extra=val)
      col = keyParts[0];
      opRaw = keyParts[1];
      val = keyParts.slice(2).join('.');
    } else {
      // Forma implícita: col=op.val (supabase-js). El valor se reparte por
      // puntos SOLO si el primer trozo es un operador conocido.
      const valParts = v.split('.');
      if (valParts.length >= 2 && KNOWN_OPS.includes(valParts[0])) {
        opRaw = valParts[0];
        val = valParts.slice(1).join('.');
      }
    }
    const op = opRaw ?? 'eq';
    if (op === 'eq') out = out.filter((r) => String(r[col]) === val);
    else if (op === 'neq') out = out.filter((r) => String(r[col]) !== val);
    else if (op === 'in') {
      const vals = val.replace(/^\(/, '').replace(/\)$/, '').split(',');
      out = out.filter((r) => vals.includes(String(r[col])));
    }
    // Los demás operadores no se usan en los flujos cubiertos.
  }
  return out;
}

// ---------------------------------------------------------------------------
// Registro de la interceptación
// ---------------------------------------------------------------------------

/**
 * Registra en `page` las rutas que simulan Supabase. `dist` debe estar
 * construido con EXPO_PUBLIC_SUPABASE_URL = http://127.0.0.1:4319/e2e-sb
 * (lo garantiza e2e/ensure-dist.mjs).
 */
export async function installSupabaseMock(page: Page, s: E2EState): Promise<void> {
  const db = makeDb(s);

  await page.route('**/**', async (route: Route) => {
    const req = route.request();
    if (!SB_ORIGIN.test(req.url())) return route.continue();
    const url = new URL(req.url());
    const p = url.pathname.replace('/e2e-sb', '');
    const method = req.method().toUpperCase();
    const rawBody = req.postData() ?? '';
    s.log.push({ path: p, method, body: rawBody, query: url.search });

    const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };
    const respondJson = (status: number, body: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({
        status,
        headers: { ...jsonHeaders, 'Content-Range': extra['Content-Range'] ?? '', ...extra },
        body: JSON.stringify(body),
      });

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // -- GoTrue: /auth/v1/* -----------------------------------------------
    if (p.startsWith('/auth/v1/')) {
      const sub = p.slice('/auth/v1/'.length).split('?')[0];
      const token = (req.headers()['authorization'] ?? '').replace(/^Bearer\s+/i, '');
      const caller = callerFromToken(token, s);

      // La ida a "Google": 302 a la redirect_to con el code en la QUERY
      // (así vuelve de verdad el flujo PKCE; el canje lo hace auth-js).
      if (sub === 'authorize') {
        const redirectTo = url.searchParams.get('redirect_to') ?? '/';
        const sep = redirectTo.includes('?') ? '&' : '?';
        const target = `${redirectTo}${sep}code=e2e-google-auth-code&state=e2e-state`;
        return route.fulfill({ status: 302, headers: { Location: target, 'Access-Control-Allow-Origin': '*' } });
      }

      if (sub === 'token' && method === 'POST') {
        const grant = url.searchParams.get('grant_type');
        const body = rawBody ? JSON.parse(rawBody) : {};
        if (grant === 'pkce') {
          if (body.auth_code && body.code_verifier) {
            return respondJson(200, sessionPayload(s, s.googleUser.id, s.googleUser.email, 'google'));
          }
          return respondJson(400, { error: 'invalid_request', error_description: 'auth_code y code_verifier obligatorios' });
        }
        if (grant === 'refresh_token') {
          if (!caller) return respondJson(401, { error: 'invalid_token', error_description: 'no active session' });
          return respondJson(200, sessionPayload(s, caller.id, caller.email, caller.provider));
        }
        return respondJson(400, { error: 'unsupported_grant_type', error_description: grant ?? '' });
      }

      if (sub === 'otp' && method === 'POST') {
        if (s.otpSendFail) return respondJson(429, { error: 'too_many_requests', error_description: 'rate limit exceeded' });
        // GoTrue real responde 200 con cuerpo JSON (auth-js hace result.json());
        // un 200 vacío con text/plain haría fallar el parse y el envío.
        return respondJson(200, {});
      }

      if (sub === 'verify' && method === 'POST') {
        if (s.otpVerifyRateLimited) return respondJson(429, { error: 'too_many_requests', error_description: 'rate limit exceeded' });
        const body = rawBody ? JSON.parse(rawBody) : {};
        if (s.otpUser && body.email === s.otpUser.email) {
          if (s.otpCode && body.token === s.otpCode) {
            return respondJson(200, sessionPayload(s, emailUserId(body.email), body.email, 'email'));
          }
          return respondJson(422, {
            code: 422,
            error_code: 'invalid-code',
            msg: 'Invalid code',
          });
        }
        return respondJson(422, { code: 422, error_code: 'invalid-code', msg: 'Invalid code' });
      }

      if (sub === 'user' && method === 'GET') {
        if (!caller) return respondJson(401, { error: 'invalid_token', error_description: 'no active session' });
        return respondJson(200, userObject(s, caller.id, caller.email, caller.provider));
      }

      if (sub.startsWith('logout')) {
        s.logoutScopes.push(url.searchParams.get('scope') ?? '');
        return route.fulfill({ status: 204, headers: {} });
      }

      return respondJson(404, { error: 'not_found', error_description: `endpoint GoTrue desconocido: ${p}` });
    }

    // -- PostgREST: /rest/v1/<tabla> ----------------------------------------
    if (p.startsWith('/rest/v1/')) {
      const rest = p.slice('/rest/v1/'.length);
      const tableName = rest.split('?')[0];
      if (tableName.startsWith('rpc/')) return respondJson(200, { ok: true });
      const table = db[tableName];
      if (!table) return respondJson(404, { message: `relación "public.${tableName}" no existe`, code: '42P01' });
      const q = url.searchParams;

      if (method === 'GET') {
        let out = applyFilters(table.rows, q);
        const order = q.get('order');
        if (order) {
          const [col, dir] = order.split('.');
          const asc = dir !== 'desc';
          out.sort((a, b) => (String(a[col]) < String(b[col]) ? (asc ? -1 : 1) : asc ? 1 : -1));
        }
        const offset = q.has('offset') ? Number(q.get('offset')) : 0;
        const limit = q.has('limit') ? Number(q.get('limit')) : undefined;
        out = out.slice(offset, limit !== undefined ? offset + limit : undefined);
        // .single() / .maybeSingle(): PostgREST lo declara con la cabecera
        // Accept: application/vnd.pgrst.object+json (NO con limit=1 en la
        // query, que es lo que supabase-js envía). 0 o 2+ filas → 406 PGRST116
        // (el cliente convierte el 406 en null solo para maybeSingle).
        const wantsObject =
          (req.headers()['accept'] ?? '').includes('vnd.pgrst.object') || (limit === 1 && offset === 0);
        if (wantsObject) {
          if (out.length === 1) return respondJson(200, out[0]);
          return respondJson(406, {
            message: 'JSON object requested, multiple (or no) rows returned',
            details: '',
            hint: 'Add a filter or use select= for multiple rows',
            code: 'PGRST116',
          });
        }
        return respondJson(200, out);
      }

      if (method === 'POST') {
        // insert o upsert (Prefer: resolution=merge-duplicates)
        const rows = (rawBody ? JSON.parse(rawBody) : []) as Row[];
        for (const r of rows) {
          if (!r || typeof r !== 'object') continue;
          const i = table.rows.findIndex((x) => table.pk.every((k) => x[k] === r[k]));
          if (i >= 0) table.rows[i] = { ...table.rows[i], ...r };
          else table.rows.push({ ...r });
        }
        return respondJson(201, rows);
      }

      if (method === 'PATCH' || method === 'PUT') {
        const patch = (rawBody ? JSON.parse(rawBody) : {}) as Row;
        const out = applyFilters(table.rows, q);
        for (const row of out) Object.assign(row, patch);
        return respondJson(200, out);
      }

      if (method === 'DELETE') {
        const out = applyFilters(table.rows, q);
        table.rows = table.rows.filter((r) => !out.includes(r));
        return respondJson(200, out);
      }

      return respondJson(405, { message: 'método no permitido' });
    }

    // -- Edge Functions: /functions/v1/<fn> ----------------------------------
    if (p.startsWith('/functions/v1/')) {
      const fn = p.slice('/functions/v1/'.length).split('?')[0];
      if (fn === 'delete-account') {
        s.deleteCalls.push(rawBody);
        return respondJson(200, { ok: true });
      }
      if (fn === 'tmdb') return respondJson(200, { data: { results: [] } });
      return respondJson(404, { error: 'function not found' });
    }

    return route.continue();
  });
}

/** Captura errores de consola descartando el ruido conocido del bundle. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  // «status of 422»: el spec de auth dispara un 422 intencionado (código
  // OTP malo) y el navegador lo loguea como error de consola.
  const NOISE = /ResizeObserver loop|favicon|404 \(Not Found\)|status of 422|WebSocket connection to 'ws:\/\//i;
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (NOISE.test(text)) return;
    errors.push(text);
  });
  return errors;
}

/**
 * Sembrar en localStorage la sesión del usuario de Google **como lo haría
 * auth-js** (clave vertice-diana-auth), para llegar a una app ya iniciada
 * sin repetir el flujo completo.
 */
export async function seedGoogleSession(page: Page, s: E2EState): Promise<void> {
  const session = seededGoogleSession(s);
  await page.addInitScript((sess) => {
    try {
      window.localStorage.setItem('vertice-diana-auth', sess);
    } catch {
      /* storage no disponible */
    }
  }, session);
}
