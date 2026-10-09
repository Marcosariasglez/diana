# ARQUITECTURA · Diana (Plan 2)

> VERTICE-PLAN-2, D2-5. Flujo **catálogo → sincronización → cliente → recomendador**
> más las capas nuevas de Plan 2 (watchlist, avisos). Lo que no está aquí está en
> [`../ESTADO.md`](../ESTADO.md) (estado global), [`supabase/README.md`](../../supabase/README.md)
> (despliegue) y [`seguridad.md`](../seguridad.md) (RLS/service_role).

## 1 · Mapa general

```
                        ┌────────────────────────────────────────────┐
   TMDB (API v3)        │  SUPABASE (producción)                    │
  /discover, /movie,    │                                            │
  /tv, /watch/…         │  Postgres (migraciones 0001–0008)         │
        │               │   catalog_titles  ← tabla de catálogo ES  │
        ▼               │   catalog_sync_state (punteres reanudables)│
  ┌─────────────┐       │   profiles / history_entries / watched    │
  │ Edge Func.  │──────▶│   initial_ratings / watchlist / …         │
  │  tmdb       │  via  │                                            │
  │ (proxy TMDB,│  sync │  Edge Functions                           │
  │  + providers)│      │   catalog-sync  ← el «cerebro» del sync   │
        ▲           │       tmdb, delete-account                     │
        │           │  Realtime (salas)                              │
        │           └───────────────┬────────────────────────────────┘
        │                           │ HTTPS (PostgREST/Rest v1, anon + RLS)
        │                           ▼
        │               ┌────────────────────────────────────────────┐
        │               │  CLIENTE (Expo SDK 57 / PWA)               │
        │               │  src/services/                              │
        │               │   index.ts  → proxies lazy mock|supabase   │
        │               │   catalog.select.ts / supabase/catalog/    │
        │               │     activeCatalogSource (CATALOG=tmdb|mock)│
        │               │  stores Zustand (feed, mood, perfil, …)    │
        │               │  features (feed/mood/grupo/detalle/…)      │
        │               │  recomendador: heuristic | content (0007)  │
        │               └────────────────────────────────────────────┘
```

## 2 · Catálogo y sincronización (D2-1)

### Origen de verdad de proveedores
[`src/constants/providers.ts`](../../src/constants/providers.ts) es **pura datos** (sin
imports de RN ni alias) y lo comparten:
- la app (deriva `src/constants/platforms.ts`: `PLATFORMS`, `platformName`), y
- la Edge Function [`supabase/functions/tmdb/index.ts`](../../supabase/functions/tmdb/index.ts)
  (construye el `PROVIDER_MAP` id interno ↔ watch-provider TMDB y el filtro
  `with_watch_providers` de `/discover`).

Si un proveedor no tiene id TMDB verificado (`tmdbProviderId: null`, p. ej.
Movistar Plus+, SkyShowtime, Atresplayer, Plex, YouTube) **la sync lo salta**; la
acción `providers` de la función `tmdb` lo verifica cuando hay
`TMDB_READ_TOKEN` (y `node scripts/verify-catalog.mjs` lo comprueba a fondo).

### La sincronización (`catalog-sync`)
- **Función**: [`supabase/functions/catalog-sync/index.ts`](../../supabase/functions/catalog-sync/index.ts).
  Protegida por secreto `CATALOG_SYNC_SECRET` (igual en `supabase secrets` y en un
  secret de GitHub; **no** lleva prefijo `SUPABASE_`).
- **Datos**: lee TMDB a través de la función `tmdb` (proxy con `TMDB_READ_TOKEN`)
  y escribe en `catalog_titles` (migración
  [`0006_catalogo.sql`](../../supabase/migrations/0006_catalogo.sql): columnas de
  contenido + `platforms_flatrate/rent/buy text[]`, FTS español `unaccent`,
  `pg_trgm`, GIN, RLS **solo lectura anon**; nadie inserta por fuera de la sync).
- **Reanudable**: `catalog_sync_state` guarda el puntero por (tipo, proveedor,
  página); un `full` o `delta` a mitad no se pierde.
- **Presupuesto**: tiempo/páginas con reintentos y rate-limit — el presupuesto de
  2 min queda por debajo de los 150 s de idle del plan gratuito.
- **Modos**: `full` (todo ES por proveedor) y `delta` (solo lo `updated_at` más
  reciente).

### Cómo se lanza (solo el dueño)
Workflow [`.github/workflows/catalog-sync.yml`](../../.github/workflows/catalog-sync.yml):
- **cron**: delta diario + full semanal;
- **manual**: `workflow_dispatch` en GitHub (Actions → catalog-sync → Run
  workflow) para la primera sincronización completa;
- comprobar el recuento después: `node scripts/verify-catalog.mjs` (compara
  `total_results` de TMDB vs filas por proveedor; falla si faltan > 5 %).

La app **no** lanza syncs: solo lee `catalog_titles`.

## 3 · Cliente: cómo lee el catálogo (D2-1.5)

- **Elección de fuente** (claveada por `EXPO_PUBLIC_CATALOG`, no por BACKEND):
  [`src/services/supabase/catalog/select.ts`](../../src/services/supabase/catalog/select.ts)
  → `activeCatalogSource`:
  - `CATALOG=tmdb` → `postgrestCatalogSource` (PostgREST sobre `catalog_titles`;
    exige `BACKEND=supabase`, `env.ts` lo comprueba en arranque).
  - `CATALOG=mock` → `mockCatalogSource` (mismo motor puro sobre datos en
    memoria): la app funciona sin servidor.
- **Módulos**: `engine.ts` (lógica pura de filtros/ordenación, testeada),
  `query.ts` (builder PostgREST), `mapper.ts` (fila → `Media`;
  `availablePlatforms` = flatrate ∪ rent ∪ buy), `postgrest.repository.ts` /
  `mock.repository.ts` (misma firma `CatalogSource`: `browse`, `search`,
  `byIds`, `candidates`, `availableNow`).
- **Quién lo consume**: feed (`useFeedData`), mood (`getMoodResults`), salas
  (deck de grupo), detalle (`getMediaById`/`getTvSeason`), Explorar
  (`app/explore.tsx`, paginado) y el bloque «Dónde verla» de la ficha
  (`availableNow` por proveedor).

Los `Media` del cliente llevan `platforms: string[]` (ids de
`providers.ts`); la disponibilidad por modalidad la resuelve `availableNow`.

## 4 · Recomendador (D2-2)

Interruptor [`EXPO_PUBLIC_RECOMMENDER`](../../src/lib/env.ts):
`heuristic` (defecto) | `content`. El cliente
([`src/services/recommender.ts`](../../src/services/recommender.ts)) degrada a
`heuristic` solo si no puede llamar al servidor (sin sesión, RPC sin desplegar,
`CATALOG≠tmdb`): el feed nunca se queda en blanco por eso.

### `heuristic` (siempre disponible, sin servidor)
Motor mock-ai puro: perfil de gusto por géneros
(`buildTasteProfile`), afinidad por título (`affinity`), predicción en décimas
(`predictTenths`/`bucketOfTenths`) y ranking contra «vistos»
(`getRankingContext`). Es la línea base de la evaluación.

### `content` (migración [`0007_recomendador.sql`](../../supabase/migrations/0007_recomendador.sql))
- Señales por título (géneros, década, duración, embedding de sinopsis) +
  perfil de gusto centrado en la media del usuario + pesos director/actor/género.
- RPCs `recommend(...)` (candidados por afinidad dentro de las plataformas del
  usuario, con explicación) y `predict_tenths(...)` (regresión por usuario con
  ≥ 20 valoraciones; prior de nota media del título con pocas). `security
  invoker`: RLS garantiza que solo ve sus valoraciones.
- **Evaluación offline obligatoria**: `node scripts/eval-recomendador.mjs`
  (leave-one-out, EAM + precisión@10 vs heurística, media del título y azar).
  Cifras reales y criterio de activación:
  [`evaluacion.md`](./evaluacion.md). **El valor por defecto de
  `EXPO_PUBLIC_RECOMMENDER` es el que gana esa evaluación** (hoy: `heuristic`).

## 5 · Capas nuevas de Plan 2

### Watchlist «Quiero ver» (D2-3)
```
UI (WatchlistButton en ficha y mazo, WatchlistSection en Perfil)
  └─▶ useWatchlistStore (Zustand persist diana.watchlist.v1 — fuente de la UI)
        └─▶ watchlistRepository (index.ts: mock → null | supabase)
              └─▶ tabla watchlist (0008, RLS watchlist_own; upsert onConflict
                  (user_id,media_type,media_id) conservando added_at del cliente)
```
Fallos de red **nunca bloquean la UI** (B-D9): `.catch(reportSyncError)`.
Al iniciar sesión, el servidor es la fuente de verdad
(`bootstrapUserData`); si 0008 no está desplegada, se conserva la copia local.
Incluida en **exportar mis datos** (`src/services/export.ts`) y en
`delete_user_data` (migración 0005, bloque `undefined_table` por seguridad del
orden de despliegue). Verificado contra Postgres 16 local:
`node scripts/sql-watchlist-local.mjs` (RLS entre usuarios, borrado, upsert).

### Avisos «Ya está en tu plataforma» (D2-4)
Detección **client-side** (la sync es diaria; el aviso llega en la próxima
comprobación, con cooldown de 1 h):
```
useAvailabilityNotifications (layout de tabs)
  ├─ watchlistStore + profileStore (plataformas favoritas)
  ├─ activeCatalogSource.byIds (catálogo ACTUAL)
  ├─ base guardada (AsyncStorage diana.availability.baseline.v1)
  └─▶ detectNewlyAvailable (lógica pura) → useNotificationTrayStore
        └─▶ bandeja app/notifications.tsx + badge de la campana (Inicio)
```
Primera vez por título solo se fija base (sin aluvión); solo se avisa de
plataformas nuevas **propias**. Propuesta de push real (VAPID/service worker/
APNs-iOS) **sin implementar**: [`propuesta-web-push.md`](./propuesta-web-push.md).

## 6 · Entorno y degradación (tabla rápida)

| `BACKEND` | `CATALOG` | `RECOMMENDER` | Qué pasa |
|-----------|-----------|---------------|----------|
| mock | mock | (cualquiera) | App 100 % local; sin login; repos mock |
| supabase | mock | (cualquiera) | Perfil real en Supabase; catálogo en memoria |
| supabase | tmdb | heuristic | Todo real; recomendador sin servidor |
| supabase | tmdb | content | Todo real + RPCs 0007 (degrada a heuristic si no están) |

`CATALOG=tmdb` con `BACKEND≠supabase` lanza en arranque (invariante de
`env.ts`). La watchlist en modo mock no espeja (no hay tabla); la bandeja de
avisos no actúa con catálogo mock (no cambia).

## 7 · Tests de frontera

| Capa | Prueba |
|------|--------|
| SQL (0006/0007/0008/0005) | `node scripts/sql-recommend-local.mjs`, `node scripts/sql-watchlist-local.mjs` (Docker postgres:16) |
| Sync (lógica pura) | `jest supabase/functions/catalog-sync` (fixtures) |
| Motor de catálogo | `jest src/services/supabase/catalog` (paginado + postgrest) |
| Recomendador | `scripts/eval-recomendador.mjs` (offline) + `jest src/services/recommender.test.ts` |
| Cliente | `npm run verify` (typecheck + lint 0 warnings + `jest --ci`) |
| UI | `npm run e2e` (Playwright, build supabase simulado) + `scripts/capturas.mjs` |
