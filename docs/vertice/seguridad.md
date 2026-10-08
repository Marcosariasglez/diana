# Seguridad VERTICE · Diana

> Actualizado 2026-10-08 (corrección de cierre). Lo que queda marcado ⚠️ exige una acción
> del dueño en producción (db push, deploy, plantillas) o una prueba manual; el agente no
> toca producción desde el repo.

## RLS (Row Level Security)

**Estado:** ✅ Verificado localmente · ⚠️ Ampliación pendiente de ejecutar en Supabase

`npm run rls` (`scripts/rls-check.mjs`) lee `.env.local` y crea **3 usuarios temporales**
(`diana-rls-*@example.com`, contraseña aleatoria) en el proyecto al que apunta ese fichero
**— hoy es el proyecto de PRODUCCIÓN; no existe proyecto de pruebas de Supabase** —,
comprueba los permisos y **borra los usuarios al terminar** (la función `delete_user_data`
no se toca en el script: solo verifica que un cliente no autenticado como service_role no
puede invocarla). Es seguro ejecutarlo cuando:

1. La migración `0005_delete_user_data.sql` esté desplegada (`npx supabase db push`), porque
   la comprobación de `delete_user_data` ahora exige **denegación por permisos** (revoke);
   si la función no existe, el check falla (antes pasaba por "función inexistente", que no
   probaba el revoke).
2. Se haya hecho un respaldo reciente (Dashboard → Database → Backups o `pg_dump`): el
   script inserta y borra filas reales de `history_entries`, `initial_ratings`, `watched`,
   `room_members`, `rooms` y `room_decisions` con datos de prueba propios de los usuarios
   temporales (nunca de usuarios existentes).

> ⚠️ **No ejecutar en paralelo con otras escrituras de prueba ni mientras se hace el
> despliegue de 0005:** el script asume el estado de la BD entre comprobaciones.

- El trigger `handle_new_user` crea el perfil automáticamente
- A inserta/lee/modifica su historial; **B no lo lee, modifica ni inserta en su nombre**
- **`initial_ratings`:** A inserta; B no lee ni inserta en nombre de A *(nuevo en D5)*
- **`watched`:** A inserta; B no lee ni inserta en nombre de A *(nuevo en D5)*
- **`profiles`:** A lee el suyo; **B no lee ni modifica el de A** *(nuevo en D5)*
- La nota debe ir en pasos de 0.5
- `tmdb_cache` no es legible por el cliente; `bump_api_hits` no es llamable
- **`delete_user_data` está bloqueado por permisos (revoke)** para clientes —el error debe ser «permission denied», no «función inexistente»— y A sigue vivo tras el intento *(D5; afinado en la corrección de cierre: antes el check daba positivo también cuando la función no existía)*
- Salas: solo el host empieza; no-miembro no ve la sala ni decide; `group_seen_keys` solo para miembros

Resultado de la última ejecución:

```
TODO OK: RLS y RPC se comportan como se espera.
```

⚠️ Las comprobaciones nuevas de D5 solo pasan en producción tras `npx supabase db push`
(migración `0005_delete_user_data.sql`): en el proyecto actual el RPC aún no existe, y el
script debe re-ejecutarse ahí.

## Service Role Key

**Estado:** ✅ No expuesta (verificado en 242 ficheros)

- `service_role` solo en `.env.local` (ignorado por `.gitignore`)
- `npm run scan:secrets` busca el valor real en `app/`, `src/`, `public/` y **`dist/`**
  sin imprimirlo: `✓ service_role no filtrada: 242 ficheros revisados en [app, src, public, dist]`
- Solo la usan las Edge Functions (`delete-account`, `tmdb`) en el servidor
- Los workflows no contienen la clave (usan `vars.SUPABASE_ANON_KEY` para keepalive)

## Keepalive

**Estado:** ✅ Corregido en D5

- El ping anterior (`GET /auth/v1/health`) **no tocaba Postgres**, que es lo que pausa en el
  plan gratuito. Ahora: `POST /rest/v1/profiles?select=id&limit=1` con la **anon key**
  (consulta mínima autenticada; RLS devuelve 0 filas, pero despierta la base de datos).
- Cada 3 días (cron `0 6 */3 * *`) + `workflow_dispatch` manual.
- ⚠️ Verificar en la próxima ejecución del workflow (GitHub → Actions → keepalive) que
  termina en verde.

## Auth

**storageKey:** `vertice-diana-auth` (explícita en `createClient`, probada en
[`src/lib/supabase.test.ts`](../../src/lib/supabase.test.ts)): no comparte sesión con Norte
aunque comparten origen. Cambiarla desloguea a quien esté dentro.

**Métodos de login:**

- Google por redirección PKCE (funciona en PWA iPhone)
- Código por correo OTP (6 dígitos, `autocomplete=one-time-code`)

**Errores:** el store devuelve **códigos** y la pantalla traduce con la tabla literal de A4
([`src/constants/authMessages.ts`](../../src/constants/authMessages.ts)). Probado en
[`src/store/useAuthStore.test.ts`](../../src/store/useAuthStore.test.ts) y
[`src/__tests__/login.test.tsx`](../../src/__tests__/login.test.tsx).

## Delete Account (Q2)

**Edge Function:** `supabase/functions/delete-account/index.ts`

- Borra **solo los datos de Diana** vía RPC `delete_user_data` (migración
  `supabase/migrations/0005_delete_user_data.sql`, `security definer`, **`revoke` a
  public/anon/authenticated**)
- Borra la identidad de Supabase Auth **solo** con `{ everywhere: true }`
- Valida el JWT del usuario con `service_role` (servidor); sin JWT → 401
- Pruebas: [`supabase/functions/delete-account/delete-account.test.ts`](../../supabase/functions/delete-account/delete-account.test.ts)
  (sin everywhere → RPC y sin `deleteUser`; everywhere → RPC + `deleteUser`; sin JWT → 401)

**Pendencias del dueño:**

1. `npx supabase db push` (migración 0005) — con copia de seguridad previa
2. `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq`
   (no existe proyecto de pruebas: se despliega directamente en este proyecto, tras el
   paso 1; la función valida el JWT y solo borra datos de Diana)
3. `npm run rls` en producción (incluye las tablas nuevas; ver arriba cuándo es seguro ejecutarlo)

## Summary

| Check | Estado | Notas |
|-------|--------|-------|
| RLS 2 usuarios (tablas base) | ✅ | `npm run rls` |
| RLS `initial_ratings`/`watched`/`profiles` | ⚠️ | Script listo; pasa tras `db push` 0005 |
| `delete_user_data` cerrado a clientes | ⚠️ | `revoke` en 0005; verificado en `rls` tras push |
| service_role no en cliente/dist | ✅ | `npm run scan:secrets` (242 ficheros) |
| Keepalive toca Postgres | ✅ | Consulta anon a `/rest/v1/profiles` |
| storageKey explícita | ✅ | `vertice-diana-auth` (prueba) |
| Delete account (datos Diana) | ✅ | Edge Function + RPC + pruebas unitarias |
| Delete account (identity everywhere) | ⚠️ | Pendiente deploy |
