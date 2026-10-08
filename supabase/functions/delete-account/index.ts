// Edge Function `delete-account` (Deno): borra datos de Diana del usuario.
// Si everywhere=true, también borra la identidad de Supabase Auth.
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

  const userId = data.user.id;
  const body = await req.json().catch(() => ({})) as { everywhere?: boolean };
  const everywhere = body.everywhere === true;

  // Borra datos de Diana en transacción (order matters for FKs)
  const { error: dbError } = await admin.rpc('delete_user_data', { target_user_id: userId });
  if (dbError) {
    console.error('DB error:', dbError);
    return json({ error: 'delete-failed' }, 500);
  }

  // Si everywhere, también borra la identidad
  if (everywhere) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Auth delete error:', authError);
      // La identidad sigue pero los datos de Diana ya se borraron
    }
  }

  return json({ ok: true });
});
