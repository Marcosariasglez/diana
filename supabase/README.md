# Despliegue de Supabase (Diana)

> **Para el dueño:** sigue estos pasos en orden. No ejecutes nada sin haber
> hecho una copia de seguridad reciente.

## 0. Copia de seguridad

**Obligatorio antes de cualquier despliegue.**

```bash
# Opción A: Dashboard de Supabase → Database → Backups → Create Backup
# Opción B: desde CLI
pg_dump -h db.<PROJECT_REF>.supabase.co -U postgres. <PROJECT_REF> -d postgres > backup-before-v2.sql
```

## 1. Migraciones de base de datos

Las migraciones viven en `supabase/migrations/`. Deben aplicarse en orden numérico.

### Estado actual

| Migración | Descripción | Desplegada |
|-----------|-------------|------------|
| `0001_schema.sql` | Esquema base (profiles, initial_ratings, history, watched, rooms, cache) | ✅ Sí |
| `0002_rls.sql` | Row Level Security (políticas de lectura/escritura) | ✅ Sí |
| `0003_rpc.sql` | RPC para salas (crear, unirse, decisiones, etc.) | ✅ Sí |
| `0004_realtime.sql` | Realtime para salas (publicación de cambios en tiempo real) | ✅ Sí |
| `0005_delete_user_data.sql` | RPC `delete_user_data(uuid)` para borrado de datos de Diana | ❌ **Pendiente** |

### Desplegar migración pendiente

```bash
npx supabase db push --project-ref hvjmewokgxgrshtzhdjq
```

Esto aplicará **solo** las migraciones que no estén desplegadas (en este caso, la 0005).

### Verificar migraciones

```bash
npx supabase db diff --project-ref hvjmewokgxgrshtzhdjq --use-migra
```

Debe mostrar "No differences found" si todo está sincronizado.

## 2. Edge Functions

### `delete-account`

Borra los datos de Diana (y, opcionalmente, la identidad VERTICE completa).

```bash
# Depender de servicio de servicio
npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq

# Configurar secret (si no está ya)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<TU_SERVICE_ROLE_KEY> --project-ref hvjmewokgxgrshtzhdjq
```

**Verificar:** La función necesita el secret `SUPABASE_SERVICE_ROLE_KEY` para poder invocar el RPC `delete_user_data` (que tiene `REVOKE` a todos).

### `tmdb`

Cache de respuestas de TMDB (modo `CATALOG=tmdb`).

```bash
npx supabase functions deploy tmdb --project-ref hvjmewokgxgrshtzhdjq
```

Esta función ya debería estar desplegada (se usa en producción).

## 3. Comprobación post-despliegue

### Verificar que el RPC existe y es invokable

```bash
# Solo service_role puede invocar: verifica desde la función, no desde el cliente
curl -X POST https://hvjmewokgxgrshtzhdjq.supabase.co/rest/v1/rpc/delete_user_data \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"p_target_user_id": "00000000-0000-0000-0000-000000000000"}'
```

Debería devolver `{"error":"bad-input"}` (user_id no existe, pero el RPC existe y responde).

### Verificar que la Edge Function responde

```bash
curl -X POST https://hvjmewokgxgrshtzhdjq.supabase.co/functions/v1/delete-account \
  -H "Authorization: Bearer <TU_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"everywhere": false}'
```

## 4. Cuando es seguro ejecutar `npm run rls`

El script `scripts/rls-check.mjs` lee `.env.local` y apunta al proyecto de producción.
Crea 3 usuarios temporales (`diana-rls-*@example.com`), comprueba RLS y los borra al terminar.

**Solo ejecutar si:**
1. ✅ La migración 0005 está desplegada (el check de `delete_user_data` exige denegación por permisos)
2. ✅ Hay un respaldo reciente de la base de datos
3. ✅ No hay escrituras en paralelo (evita conflictos con usuarios reales)

```bash
npm run rls
```

## 5. Keepalive

El proyecto de Supabase (plan gratuito) se pausa tras ~7 días sin actividad.
El keepalive (`supabase/keepalive.yml`) hace un ping cada 3 días para evitarlo.

**Verificar que funciona:**
1. Ve a GitHub → Actions → `keepalive` y comprueba que los jobs completan con éxito.
2. El ping es una consulta mínima con la `anon key` a Postgres (cuenta como actividad real).

Si el keepalive falla, **ambas apps (Diana y Norte) perderán acceso** al proyecto compartido.

## 6. Plantillas de correo (Supabase → Authentication)

Para que el "código por correo" funcione:

1. **URL Configuration** → Añadir Redirect URLs:
   - `https://marcosariasglez.github.io/diana/` (producción)
   - `http://localhost:8088` (desarrollo)

2. **Email Templates** → Editar "Magic Link" y "Confirm signup":
   - Incluir `{{ .Token }}` (6 dígitos) en el cuerpo del email.
   - Sin esto, Supabase envía un enlace mágico en lugar de un código.

3. **SMTP Settings** → Configurar SMTP propio (Resend, Brevo...):
   - El SMTP incorporado de Supabase tiene un límite muy bajo (pensado para pruebas).
   - Planes gratuitos de Resend/Brevo son suficientes para uso personal.
