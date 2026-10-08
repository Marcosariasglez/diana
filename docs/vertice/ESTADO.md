# ESTADO DEL PROYECTO VERTICE · Diana

> Actualizado 2026-10-08T21:36+02:00. Ejecución continua D0→D6 completada (todo aprobado por el dueño).
> **Plan VERTICE terminado.** Quedan solo los pasos de producción del dueño (abajo) y las
> correcciones de cierre de este 2026-10-08.
>
> Este fichero es la **única fuente de verdad del estado**. Los antiguos `PROGRESS.md`,
> `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` se eliminaron el 2026-10-08: lo útil
> quedó absorbido en «Registro histórico (B0–B7)» al final de este documento.

## Último verify (tras las correcciones de cierre, 2026-10-08)

```
Test Suites: 72 passed, 72 total
Tests:       418 passed, 418 total
```

**Auditoría de estilos:** `✓ Auditoría de estilos: todo limpio.` (0 problemas)
**Build web (producción, base `/diana`):** `Exported: dist` · `PWA lista (base "/diana")`
**Escáner de secretos:** `✓ service_role no filtrada: 242 ficheros revisados en [app, src, public, dist]`

> Línea base previa (tras D6): `72 passed / 417 passed` (+1 test: comparación del parámetro
> del RPC con la firma de la migración).

## Correcciones de cierre (2026-10-08, post-D6)

| # | Corrección | Evidencia |
|---|------------|-----------|
| 1 | El RPC `delete_user_data` se llamaba con `{ target_user_id }` en la Edge Function y en `rls-check`, pero la migración 0005 declara `p_target_user_id`: en Supabase real era "function not found" y el borrado fallaba. Unificado en las llamadas (sin tocar la migración) + prueba nueva que compara el parámetro de `index.ts` con la firma SQL leyendo ambos ficheros. `rls-check` ahora exige denegación **por permisos** (revoke), no "función inexistente" | 7/7 tests en `delete-account.test.ts`; commit `ef5d901` |
| 2 | La 0005 borraba **todas** las salas huérfanas del sistema. Ahora el borrado de `room_decisions`, `room_members` y `rooms` está restringido a las salas en las que participaba el usuario (miembro o anfitrión), calculadas antes de borrar sus filas. Se editó la 0005 directamente (aún no desplegada): una sola versión canónica, sin 0006 | commit `1e72777` |
| 3 | Limpieza: borrados `build-*.log`, `build2.log`, `serve-3001.log`; `*.log` en `.gitignore`; docs de estado unificadas aquí (se eliminaron `PROGRESS.md`, `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` absorbiendo lo útil sin credenciales) | commit `d7c2cc4` |
| 4 | Logotipo del login/bienvenida: era un círculo (radio 28); el contrato A3.4 dice cuadrado de esquinas redondeadas (34 px radio 11; a 56 px radio 18). Corregido en `login.tsx` y `welcome.tsx` + capturas «después» rehechas (14 PNG: 7 pantallas × claro/oscuro, ahora incluye bienvenida) | commit `826495a` |
| 5 | `seguridad.md`/`paridad.md`/`README.md`: corregida la afirmación de que `rls-check` se ejecutaba «en un proyecto de pruebas» (no existe); el script apunta a producción vía `.env.local` y crea/borra 3 usuarios temporales. Documentado cuándo es seguro ejecutarlo (0005 desplegada + respaldo reciente, sin escrituras en paralelo) | commit `22e0f37` |

## Tabla de fases D0 → D6

| Fase | Estado | Hecho | Evidencia |
|------|--------|-------|-----------|
| **D0 · Red de seguridad** | ✅ Hecho | git limpio, verify línea base, capturas "antes" | 10 PNG + informe.json; línea base: 62 suites/364 tests |
| **D1 · Tokens y tema** | ✅ Hecho | tokens.ts, ThemeProvider, useTheme, appearance v2, fuentes estáticas, typography.ts X3, shadows.ts, colors.ts BORRADO, ESLint anti-hex | grep theme/colors=0; lint 0 warnings |
| **D2 · Componentes al contrato** | ✅ Hecho | Button(ink), Card(r24+sombra), FabButton(58,acc,40%), BottomNav(88,card 92% blur16,ink,FAB+16), SegmentedControl(ink/onInk), Pill/Chip/Toast/BottomSheet, nuevos ListRow/ProfileCard/TextField/ConfirmSheet(frase)/GoogleButton con pruebas, pantallas X5 (títulos 28/800, secciones 19/800+acc, insignias accSoft+acc, posters 20/24, swipe 54, sala pad24) | verify 67/381; auditoría 0 |
| **D3 · Perfil + Cuenta** | ✅ Hecho | account.tsx A5 completa (correo, nombre máx40, exportMyData, cerrar 1/todos, borrar con frase + everywhere), useAuthStore con códigos A4 + signOutEverywhere, storageKey vertice-diana-auth, migración 0005 delete_user_data (corregida: alcance de salas restringido al usuario), profile.tsx con displayName + pie, «Reiniciar prototipo» fuera de producción | verify 72/417; auditoría 0 |
| **D4 · Login A4** | ✅ Hecho | login.tsx A4 (logotipo 56 cuadrado redondeado radio 18, Google, separador, correo, código 6 one-time-code, reenviar 30s, cambiar correo, errores literales de authMessages, pie legal) + 12 pruebas por estado | verify 72/417; auditoría 0 |
| **D5 · Endurecimiento** | ✅ Hecho | rls-check ampliado (initial_ratings, watched, profiles, delete_user_data), `npm run scan:secrets` (242 ficheros, dist incluido), keepalive → consulta anon a Postgres, seguridad.md actualizado | scan:secrets OK; rls ampliado pasa tras `db push` 0005 |
| **D6 · Documentación** | ✅ Hecho | README.md nuevo; **fuentes estáticas corregidas** (las 7 TTF estaban corruptas = HTML; regeneradas con fontTools: `npm run fonts`); capturas "después" 390×844 claro+oscuro de login/inicio/mood/match/perfil/cuenta; **paridad.md** (A8 + X6 punto a punto, comparado contra `referencia/`); build:web de producción; cifras tabulares X3 completadas | 12 PNG + informe.json; paridad A8 marcado; verify 72/417 |

## Pendiente

**Nada del plan.** El plan VERTICE (D0→D6) está terminado.

## Pendientes del dueño (no tocan producción)

**En este orden** (detalle en la sección final de este documento):

1. Copia de seguridad de la base de Supabase (Dashboard → Database → Backups o `pg_dump`)
2. `npx supabase db push --project-ref hvjmewokgxgrshtzhdjq` (migración 0005 `delete_user_data`)
3. `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` + `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` si no está
4. `git push` (CI: verify + build + Pages en `/diana`)
5. Supabase → Authentication: Redirect URLs reales + plantillas «Magic Link»/«Confirm signup» con `{{ .Token }}` + SMTP propio (Resend/Brevo; el SMTP incorporado tiene límite bajo por hora)
6. Prueba real en iPhone/PWA (guion D5 de la Parte C): Google + código por correo, cerrar en todos, exportar, borrar (verificar en BD)
7. Re-ejecutar `npm run rls` cuando haya desplegado 0005 (ahora exige denegación por permisos en `delete_user_data`; crea y borra 3 usuarios temporales)

## Registro histórico (B0–B7, antes del plan VERTICE)

> Absorbido de `PROGRESS.md`, `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md`
> (eliminado 2026-10-08). No contiene credenciales: solo hechos de despliegue.

**Despliegue (activo):**

- Repo: `https://github.com/marcosariasglez/diana` · Pages: `https://marcosariasglez.github.io/diana/`
- Supabase: proyecto `hvjmewokgxgrshtzhdjq`, región West EU (Ireland)
- Google OAuth: configurado; redirect `https://hvjmewokgxgrshtzhdjq.supabase.co/auth/v1/callback`
- Variables de CI (GitHub Actions): `BACKEND=supabase`, `CATALOG=tmdb` (ver `.github/workflows/deploy.yml`)
- PWA instalable en iPhone con sesión persistente

**Fases completadas (B):**

| Fase | Qué se hizo |
|------|-------------|
| B0 · PWA local | Tests + build web + iconos PWA (61 tests en la época) |
| B1 · GitHub Pages | Deploy automático con workflow, URL `/diana` |
| B2 · Login Google | OAuth por redirección PKCE (funciona en la PWA de iPhone) |
| B3 · Datos de usuario | Migraciones 0001–0004 en Supabase (esquema, RLS, RPC, realtime), aislamiento por usuario, bootstrap al login |
| B4 · Salas tiempo real | Repositorios + realtime |
| B5 · TMDB | Edge Function `tmdb` desplegada; repositorios en `src/services/tmdb/` (catalog, search, import, invoke); `genreIndex.ts`; switch mock/tmdb por `catalog.select.ts`; lazy loading en `services/index.ts` |
| B6 · Exportar/borrar | Cumplido en VERTICE D3/D5 (`exportMyData` + `delete-account`) |
| B7 · Letterboxd | Importación CSV/ZIP en bienvenida |

**Migraciones:** 0001–0004 ya estaban en producción; 0005 (`delete_user_data`) pendiente de `db push` (pendiente 2 del dueño).
