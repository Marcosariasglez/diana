# Diana

App de cine (PWA móvil): descubrimiento personalizado con IA de predicción de gustos, mood
wizard, salas de amigos en tiempo real e importación Letterboxd.

- **Stack:** Expo SDK 57 / React Native + expo-router + NativeWind + Zustand + Supabase
- **Backend:** Supabase (Auth + Postgres + Realtime + Edge Functions `tmdb` y `delete-account`)
- **Diseño:** sistema visual VERTICE (idéntico a Norte) — ver [`VERTICE-README.md`](VERTICE-README.md)
- **Estado real del proyecto:** [`docs/vertice/ESTADO.md`](docs/vertice/ESTADO.md)
- **Paridad con Norte:** [`docs/vertice/paridad.md`](docs/vertice/paridad.md)
- **Seguridad (RLS, service_role, keepalive):** [`docs/vertice/seguridad.md`](docs/vertice/seguridad.md)
- **Despliegue de Supabase (migraciones + funciones):** [`supabase/README.md`](supabase/README.md)

> Fuente única de verdad del estado: [`docs/vertice/ESTADO.md`](docs/vertice/ESTADO.md)
> (incluye el registro histórico de las fases B0–B7; los antiguos `PROGRESS.md`,
> `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` se eliminaron el 2026-10-08).
> Documentación histórica previa en [`docs/vertice/historico/`](docs/vertice/historico/).

## Arranque local

```bash
npm ci
# crea .env.local (ignorado por git) con:
#   EXPO_PUBLIC_BACKEND=mock            # mock | supabase
#   EXPO_PUBLIC_CATALOG=mock            # mock | tmdb (exige BACKEND=supabase)
#   EXPO_PUBLIC_RECOMMENDER=heuristic   # heuristic | content (content solo con CATALOG=tmdb)
#   EXPO_PUBLIC_BASE_URL=               # p. ej. /diana en GitHub Pages
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...       # SOLO local / servidor; jamás en el repo
npm start                 # desarrollo
npm run build:web         # export web → dist/
```

Modos: con `BACKEND=mock` la app no pide inicio de sesión y todo es local; con
`BACKEND=supabase` hay puerta de acceso (Google PKCE o código por correo).

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run verify` | typecheck + lint (0 warnings) + tests |
| `npm run build:web` | `expo export --platform web` + postbuild PWA |
| `npm run e2e` | Suite E2E Playwright (requiere `npm run build:web` antes). **No** está en `verify` ni en el CI de despliegue: es una verificación aparte |
| `npm run rls` | Prueba de aislamiento RLS con usuarios reales (lee `.env.local`) |
| `npm run scan:secrets` | Comprobar que `service_role` no filtra en `app/ src/ public/ dist/` |
| `npm run icons` | Regenerar iconos PWA |
| `node scripts/auditoria-estilos.mjs` | Auditoría de estilo X6 (sin hex sueltos, radios, pesos) |
| `node scripts/contraste.mjs` | Contraste WCAG AA de todos los pares texto/fondo de `tokens.ts` (claro y oscuro) |
| `node scripts/capturas.mjs [--despues]` | Capturas 390×844 claro/oscuro (Playwright + `dist` servido) |
| `node scripts/eval-recomendador.mjs` | Evaluación offline del recomendador (EAM + precisión@10 vs heurística/media/azar). Resultados: `docs/vertice/plan2/evaluacion.md` |
| `node scripts/sql-recommend-local.mjs` | Verifica las migraciones 0007 (recomendador) + RLS contra un Postgres 16 local de Docker (`--keep` para depurar) |
| `node scripts/sql-watchlist-local.mjs` | Verifica la migración 0008 (watchlist) + el borrado de 0005 contra Postgres 16 local de Docker |
| `node scripts/verify-catalog.mjs` | Compara `total_results` de TMDB vs filas de `catalog_titles` por proveedor (falla si faltan > 5 %). Requiere `TMDB_READ_TOKEN` en `.env.local` |

**Ejecución de la batería de pruebas:** `npm run verify` se ejecuta **una sola vez y sin
otras ejecuciones en paralelo** (en paralelo se agotan los tiempos y salen fallos falsos
de suites). La auditoría de estilos (`node scripts/auditoria-estilos.mjs`) va justo después,
en la misma secuencia, no al mismo tiempo.

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `EXPO_PUBLIC_BACKEND` | `mock` \| `supabase` |
| `EXPO_PUBLIC_CATALOG` | `mock` \| `tmdb` (exige `BACKEND=supabase`) |
| `EXPO_PUBLIC_RECOMMENDER` | `heuristic` (defecto) \| `content`. «content» usa los RPCs de la migración 0007; si no están desplegados, el cliente degrada a `heuristic` sin romper el feed |
| `EXPO_PUBLIC_BASE_URL` | Prefijo de despliegue (p. ej. `/diana`) |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cliente (público) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo** `.env.local` local / secretos de Edge Functions. Nunca en el repo ni en el front |
| `TMDB_READ_TOKEN` | **Solo** `.env.local` (scripts locales) y secreto de Supabase (función `tmdb`). Nunca en el repo |
| `CATALOG_SYNC_SECRET` | **Solo** secreto de Supabase (`supabase secrets`) y secret de GitHub para lanzar la sync. No lleva prefijo `SUPABASE_` |

`.env.local` está ignorado por git. La `service_role` vive únicamente en el servidor
(Edge Functions) y en el `.env.local` del dueño; `npm run scan:secrets` lo vigila.

## Estructura

```
app/                      rutas (expo-router)
  (tabs)/                 Inicio · Mood · Match · Perfil + FAB
  (onboarding)/           bienvenida y swipe de 20 pelis
  account.tsx             pantalla Cuenta (A5)
  login.tsx               pantalla de acceso (A4)
  detail/ room/ see-all/  ficha, salas, categorías
  daily-log mood-wizard mood-results notifications
src/
  theme/                  tokens VERTICE (tokens.ts), ThemeProvider/useTheme,
                          tipografía X3, sombras, alpha.ts
  components/ui/          componentes del contrato A3.4 (Button, Card, BottomNav,
                          FabButton, SegmentedControl, ListRow, ProfileCard,
                          TextField, ConfirmSheet, GoogleButton, …)
  components/features/    componentes de cine (Poster, SwipeDeck, SlotReveal, …)
  store/                  Zustand (auth, perfil, historial, mood, salas, ajustes)
  services/               repositorios mock/Supabase + export + tmdb
  features/ room/         lógica de salas en tiempo real
  lib/                    env, cliente Supabase
public/                   assets estáticos (iconos PWA, páginas legales)
supabase/
  migrations/             0001–0008 (esquema, RLS, RPC, realtime, delete_user_data,
                          catálogo, recomendador, watchlist)
  functions/              Edge Functions tmdb, catalog-sync, delete-account
scripts/                  capturas, auditoría de estilos, contraste, PWA, secretos,
                          rls-check, eval-recomendador, sql-* (Postgres local),
                          verify-catalog
docs/vertice/             ESTADO, paridad, seguridad, contrato, capturas, histórico,
                          plan2 (INFORME, ARQUITECTURA, evaluación, propuesta Web Push)
```

## Catálogo completo y recomendador (Plan 2)

Arquitectura completa (catálogo → sincronización → cliente → recomendador,
watchlist y avisos): [`docs/vertice/plan2/ARQUITECTURA.md`](docs/vertice/plan2/ARQUITECTURA.md).

### Cómo lanzar la sincronización de catálogo (solo el dueño; la app no la lanza)

1. **Prerrequisitos** (ver también [`supabase/README.md`](supabase/README.md)):
   - extensiones activadas en Supabase → Database → Extensions: `pg_trgm`,
     `unaccent` y `vector` (pgvector);
   - migraciones **0006**, **0007** y **0008** aplicadas a mano en el SQL Editor
     (0005 también si aún no está; 0001–0004 ya están en producción);
   - `npx supabase functions deploy catalog-sync` y
     `npx supabase functions deploy tmdb`;
   - secretos: `npx supabase secrets set CATALOG_SYNC_SECRET=<valor>` y el mismo
     valor como secret del repositorio de GitHub (el workflow lo lee); el
     secreto **no** puede llevar prefijo `SUPABASE_`.
2. **Primera sincronización completa**: GitHub → Actions → *catalog-sync* →
   **Run workflow** (`workflow_dispatch` del
   [`.github/workflows/catalog-sync.yml`](.github/workflows/catalog-sync.yml)).
   Los cron (delta diario + full semanal) mantienen el catálogo; cada ejecución
   cabe en ~2 min (presupuesto < 150 s de idle del plan gratuito) y es
   reanudable por `catalog_sync_state` si se corta a mitad.
3. **Comprobar el resultado**: `node scripts/verify-catalog.mjs` (compara
   `total_results` de TMDB vs filas por proveedor; falla si faltan > 5 %).
4. **Activar el catálogo en la app**: `EXPO_PUBLIC_CATALOG=tmdb` en `.env.local`
   / CI y `git push` (CI: verify + build + Pages).
5. **Recomendador (opcional)**: `EXPO_PUBLIC_RECOMMENDER=content` (los RPCs de
   0007 ya están aplicados en el paso 1). La evaluación que justifica el valor
   por defecto: [`docs/vertice/plan2/evaluacion.md`](docs/vertice/plan2/evaluacion.md)
   (`node scripts/eval-recomendador.mjs` para repetirla).

## E2E (Playwright)

`npm run e2e` sirve `dist/` (generado con `npm run build:web` y `BACKEND=supabase`) y
**simula las llamadas HTTP de Supabase** con `page.route` (`/auth/v1/*`, `/rest/v1/*`,
`/functions/v1/*`) con respuestas de la forma que devuelve GoTrue de verdad. Cubre:
redirección de acceso, vuelta de Google con `?code=…&state=…` (canje y limpieza de la
URL), código por correo (enviar, error, correcto), cierre de sesión (local y global)
con limpieza de storage, borrado de cuenta (frase `BORRAR MI CUENTA` y cuerpo
`{ everywhere }`), exportar (JSON válido), persistencia de Apariencia y ausencia de
errores de consola. Es una suite **separada** de `verify` y del CI de despliegue.

## Deploy

GitHub Pages en `/diana` (`.github/workflows/deploy.yml`: verify + build + 404 fallback).
Keepalive de Supabase cada 3 días (`.github/workflows/keepalive.yml`, consulta anon a Postgres).

### Cuándo es seguro ejecutar `npm run rls`

El script (`scripts/rls-check.mjs`) lee `.env.local` y apunta al proyecto de producción
(**no existe proyecto de pruebas de Supabase**). Crea 3 usuarios temporales
(`diana-rls-*@example.com`), comprueba RLS y los borra al terminar. Solo ejecutarlo:

- **con la migración 0005 desplegada** (el check de `delete_user_data` exige denegación
  por permisos; si la función no existe, falla) y
- **con un respaldo reciente** de la base de datos.

### Pendientes del dueño (el agente no toca producción), en este orden

1. Copia de seguridad de la base de Supabase
2. `npx supabase db push` — aplica la migración `0005_delete_user_data.sql`
3. `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq`
   (+ `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` si no está)
4. `git push` (CI: verify + build + Pages en `/diana`)
5. Supabase → Authentication: Redirect URLs reales + plantillas «Magic Link» y «Confirm signup» con `{{ .Token }}` + SMTP propio (Resend/Brevo)
6. Prueba real del guion D5 (PC, iPhone, PWA instalada)
7. Re-ejecutar `npm run rls` en producción (ver arriba cuándo es seguro)
