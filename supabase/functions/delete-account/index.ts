// Edge Function `delete-account` (Deno): elimina al usuario que la llama. Los `on delete cascade`
// del esquema borran perfil, valoraciones, historial y membresias de sala.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data } = await admin.auth.getUser(jwt);
  if (!data?.user) return json({ error: 'unauthorized' }, 401);
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return json({ error: 'delete-failed' }, 500);
  return json({ ok: true });
});
