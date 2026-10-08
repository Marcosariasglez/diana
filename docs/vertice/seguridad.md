# Seguridad VERTICE · Diana

> Generado 2026-10-08 tras fases D0–D5.

## RLS (Row Level Security)

**Estado:** ✅ TODO OK

El script `scripts/rls-check.mjs` (`npm run rls`) verifica con dos usuarios de prueba (A y B) que:

- El trigger `handle_new_user` crea el perfil automáticamente
- A puede insertar/leer/modificar/sus datos
- B no puede leer, modificar ni insertar en nombre de A
- La nota debe ir en pasos de 0.5
- `tmdb_cache` no es legible por el cliente
- `bump_api_hits` no es llamable por el cliente
- Salas: solo el host puede empezar, no-miembros no ven la sala
- `group_seen_keys` solo devuelve datos del usuario autenticado

**Resultado último ejecución:**
```
TODO OK: RLS y RPC se comportan como se espera.
```

## Service Role Key

**Estado:** ✅ No expuesta

- `service_role` solo en `.env.local` (ignorado por `.gitignore`)
- No aparece en `app/`, `src/`, `public/` ni en `dist/` tras `build:web`
- Solo usada en Edge Functions (`delete-account`, `tmdb`) donde pertenece

**Comandos de verificación:**
```bash
grep -r "service_role" app/ src/ public/  # 0 resultados
grep -r "SUPABASE_SERVICE_ROLE" .env.local  # Solo aquí
```

## Keepalive

**Estado:** ✅ Funcional

- `.github/workflows/keepalive.yml` ejecuta ping a Supabase cada 3 días
- Evita la pausa del proyecto gratuito tras 7 días de inactividad
- El ping cuenta como actividad real (consulta autenticada con `anon key`)

## Auth

**storageKey:** `vertice-diana-auth` (explícita en `createClient`)

**Métodos de login:**
- Google por redirección PKCE (funciona en PWA iPhone)
- Código por correo OTP (6 dígitos, `autocomplete=one-time-code`)

**Textos de error:** Tabla única en `src/constants/authMessages.ts` con frases literales A4.

## Delete Account

**Edge Function:** `supabase/functions/delete-account/index.ts`

- Borra solo datos de Diana (profiles, initial_ratings, history_entries, watched, room_members, rooms)
- Solo borra identidad de Supabase Auth si `{ everywhere: true }`
- Valida JWT con `service_role` en servidor (nunca en cliente)

**Pendencias del dueño:**
1. `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` (primero en proyecto de pruebas)
2. Crear RPC `delete_user_data` en Supabase para la transacción SQL

## Summary

| Check | Estado | Notas |
|-------|--------|-------|
| RLS dos usuarios | ✅ | 22 tests pasando |
| service_role no en cliente | ✅ | Solo `.env.local` y Edge Functions |
| service_role no en dist | ✅ | Verificar tras build:web |
| Keepalive funcional | ✅ | Ping cada 3 días |
| storageKey explícita | ✅ | `vertice-diana-auth` |
| Delete account (datos Diana) | ✅ | Edge Function lista |
| Delete account (identity) | ⚠️ | Pendiente deploy |
| RPC delete_user_data | ⚠️ | Pendiente creación |
