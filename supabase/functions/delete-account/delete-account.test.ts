/// <reference types="jest" />
/**
 * Prueba de la Edge Function `delete-account` (Q2):
 * - sin everywhere → borra SOLO los datos de Diana (RPC delete_user_data),
 *   NO toca la identidad de Auth.
 * - con everywhere → además borra la identidad (admin.deleteUser).
 * - sin JWT válido → 401.
 * - el parámetro del RPC coincide con la firma de la migración 0005
 *   (comparando ambos ficheros en disco): si divergen, Supabase real
 *   respondería "function not found" y el borrado fallaría.
 *
 * Mock de service_role: el cliente Supabase se sustituye por uno falso que
 * registra las llamadas (lo que en producción haría la clave de servicio,
 * que solo vive en el servidor, nunca en el cliente).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Handler = (req: Request) => Promise<Response> | Response;

const rpcCalls: Array<{ fn: string; params: unknown }> = [];
const authDeleteCalls: string[] = [];
let jwtUser: { id: string } | null = { id: 'user-1' };

const mockCreateClient = jest.fn(() => ({
  auth: {
    getUser: jest.fn(async (jwt: string) => ({
      data: { user: jwt ? jwtUser : null },
    })),
    admin: {
      deleteUser: jest.fn(async (id: string) => {
        authDeleteCalls.push(id);
        return { error: null };
      }),
    },
  },
  rpc: jest.fn(async (fn: string, params: unknown) => {
    rpcCalls.push({ fn, params });
    return { error: null };
  }),
}));

// Simula el entorno Deno de la Edge Function ANTES de cargar el módulo.
const denoEnv: Record<string, string | undefined> = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role',
};
const globals = globalThis as unknown as { Deno: unknown; __handler: Handler };
globals.Deno = {
  env: { get: (k: string) => denoEnv[k] },
  serve: (handler: Handler) => {
    globals.__handler = handler;
  },
};

jest.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: (...args: [string, string]) => mockCreateClient(...args),
}));

// Carga el módulo de la función (ejecuta Deno.serve al registrarse).
require('./index');

async function post(body: unknown, auth = 'Bearer tok'): Promise<Response> {
  const req = new Request('http://localhost/delete-account', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return globals.__handler(req);
}

describe('Edge Function delete-account (Q2)', () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    authDeleteCalls.length = 0;
    jwtUser = { id: 'user-1' };
  });

  it('sin everywhere: borra datos Diana y NO la identidad', async () => {
    const res = await post({ everywhere: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rpcCalls).toEqual([{ fn: 'delete_user_data', params: { p_target_user_id: 'user-1' } }]);
    expect(authDeleteCalls).toEqual([]);
  });

  it('everywhere:true: borra datos Diana Y la identidad', async () => {
    const res = await post({ everywhere: true });
    expect(res.status).toBe(200);
    expect(rpcCalls).toEqual([{ fn: 'delete_user_data', params: { p_target_user_id: 'user-1' } }]);
    expect(authDeleteCalls).toEqual(['user-1']);
  });

  it('body ausente: por defecto no borra la identidad', async () => {
    const res = await post(undefined);
    expect(res.status).toBe(200);
    expect(authDeleteCalls).toEqual([]);
  });

  it('sin JWT válido: 401 y no borra nada', async () => {
    jwtUser = null;
    const res = await post({ everywhere: true }, 'Bearer');
    expect(res.status).toBe(401);
    expect(rpcCalls).toEqual([]);
    expect(authDeleteCalls).toEqual([]);
  });

  it('método no POST: 405', async () => {
    const req = new Request('http://localhost/delete-account', { method: 'GET' });
    const res = await globals.__handler(req);
    expect(res.status).toBe(405);
  });

  it('Opciones CORS: 200 con cabeceras', async () => {
    const req = new Request('http://localhost/delete-account', { method: 'OPTIONS' });
    const res = await globals.__handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('el parámetro del RPC coincide con la firma de la migración 0005', () => {
    // Lee los DOS ficheros en disco y compara el nombre del parámetro:
    // Postgres resuelve los parámetros del RPC por nombre; si divergen,
    // Supabase real respondería "function not found" y el borrado fallaría.
    // (__dirname = supabase/functions/delete-account → subir 3 al root del repo.)
    const root = join(__dirname, '..', '..', '..');
    const fnSrc = readFileSync(join(__dirname, 'index.ts'), 'utf8');
    const sqlSrc = readFileSync(join(root, 'supabase', 'migrations', '0005_delete_user_data.sql'), 'utf8');

    // Fichero de la migración: firma `delete_user_data(p_target_user_id uuid)`
    // (toma el primer parámetro; si la firma cambiera a varios, la prueba
    // exige que ambos coincidan uno a uno).
    const sqlFn = sqlSrc.match(/create\s+or\s+replace\s+function\s+public\.delete_user_data\s*\(([^)]*)\)/i);
    expect(sqlFn).not.toBeNull();
    const sqlParams = sqlFn![1]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(/\s+/)[0]);

    // Fichero de la función: objeto de parámetros de admin.rpc('delete_user_data', {...})
    const rpcCall = fnSrc.match(/admin\.rpc\(\s*['"]delete_user_data['"]\s*,\s*\{([^}]*)\}/);
    expect(rpcCall).not.toBeNull();
    const rpcParams = Object.keys(
      Object.fromEntries(
        rpcCall![1]
          .split(',')
          .map((kv) => kv.trim())
          .filter(Boolean)
          .map((kv) => kv.split(':').map((s) => s.trim())),
      ),
    );

    expect(rpcParams).toEqual(sqlParams);
  });
});
