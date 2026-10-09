# INFORME · Plan 2 (Diana): catálogo completo y recomendador real

> Turno autónomo sobre `VERTICE-PLAN-2.md` (rama `vertice/plan2`, sin push ni merge).
> Producción intocable: sin `db push`, sin `functions deploy`, sin `secrets`, sin `npm run rls`.
> Todo se prueba con simulaciones locales; lo que exija producción queda como «pendiente del dueño»
> con el comando exacto. Líneas finales de las baterías se pegan tal cual.

## Línea base de partida

`VERTICE-PLAN-2.md` indica como referencia **73 suites / 429 tests**. El repo local arrancó con
`app/account.tsx` con una corrección sin commitear (rótulo «APARICENCIA» → «APARIENCIA»), que se
commiteó primero en la rama (commit `06fa791`).

**Línea base del reanudado (2026-10-09, después de D2-1):**

`npm run verify`:
```
Test Suites: 79 passed, 79 total
Tests:       482 passed, 482 total
```
`node scripts/auditoria-estilos.mjs`:
```
✓ Auditoría de estilos: todo limpio.
```

## Estado por tarea

| Tarea | Estado | Commits | Evidencia / líneas finales | Qué no se pudo comprobar |
|-------|--------|---------|-----------------------------|--------------------------|
| D2-0 · Deuda inmediata | **hecha** | `b7c5d43` | verify + auditoría + e2e account-desktop (abajo) | Integración real con Supabase/iPhone |
| D2-1 · Catálogo completo ES | **hecha** (pendiente dueño: despliegue + token TMDB) | `8700e02` `10a40b8` `2758c6b` `b3b18d4` `056b29b` `28b86ac` `ce83aa1` | verify (79 suites / 482 tests) + auditoría + capturas `docs/vertice/capturas/plan2/` | No se pudo verificar contra la API real de TMDB (sin `TMDB_READ_TOKEN`) ni contra Supabase real (producción intocable); ids TMDB de proveedores sin evidencia en el repo quedaron como `null` (Movistar Plus+, SkyShowtime, Atresplayer, Plex, YouTube) y la sync los salta hasta verificarlos |
| D2-2 · Recomendador real | **hecha** (pendiente dueño: desplegar 0007 + decidir `content`) | `788c908` `c9bdb75` `11d6d0b` | eval con cifras reales (`evaluacion.md`: heuristic 5.42 EAM / 0.569 p@10; content 3.705 / 0.444) → `heuristic` queda por defecto; 20 tests nuevos; SQL 0007 probado contra Postgres+pgvector local | No se pudo medir contra Supabase real ni con el embedding gte-small real; la evaluación usa embeddings sintéticos del mock (lógica del modelo, no calidad del embedding) |
| D2-3 · «Quiero ver» y listas | **hecha** (pendiente dueño: desplegar 0008) | `0f3625f` | verify (87/531) + auditoría + scan; SQL 0008/0005 verificado contra Postgres 16 local (`sql-watchlist-local.mjs`: RLS entre usuarios, borrado, upsert); 19 tests nuevos | No se pudo probar contra Supabase real (producción intocable); la prueba de borrado «solo lo del usuario» corrió en Postgres local |
| D2-4 · Avisos (si queda tiempo) | **hecha** (bandeja in-app; push solo propuesta) | `20be74c` | verify (90/554) + auditoría + scan; 23 tests (lógica, store, hook); propuesta Web Push documentada sin implementar | El aviso llega en la próxima comprobación (cooldown 1 h), no en tiempo real; el push real no se implementa (propuesta en `propuesta-web-push.md`) |
| D2-5 · Calidad | **hecha** | `ab7f8a6` `1ce3e06` | verify final (95 suites / 581 tests) + auditoría + scan; 13 tests nuevos en stores/repos críticos; `ARQUITECTURA.md` + README (vars, comandos, lanzar sync) | Sin `TMDB_READ_TOKEN` no se pudo re-ejecutar `verify-catalog.mjs` contra la API real (su lógica ya está testeada) |

## D2-1 · Catálogo completo de España — resumen de lo hecho (commits existentes)

- **D2-1.1** (`8700e02`): origen de verdad único `src/constants/providers.ts` (lo importan la app y la función `tmdb`); los ids sin evidencia en el repo quedaron `tmdbProviderId: null` y la sync los salta; prueba `providers.test.ts` que compara ambos orígenes.
- **D2-1.2/1.3** (`10a40b8`): migración `supabase/migrations/0006_catalogo.sql` (`catalog_titles` + `catalog_sync_state`, GIN, FTS español + pg_trgm, RLS solo lectura) **solo escrita** + Edge Function `supabase/functions/catalog-sync/index.ts` (protegida por secreto, reanudable por `catalog_sync_state`, presupuesto de tiempo/páginas, rate-limit y reintentos, modos `full`/`delta`) con tests de fixtures (`catalog-sync.test.ts`).
- **D2-1.4** (`2758c6b`): workflow `.github/workflows/catalog-sync.yml` (cron delta diario + full semanal + `workflow_dispatch`), presupuesto 2 min < 150 s de idle del plan gratuito.
- **D2-1.5** (`b3b18d4`): repositorio paginado `src/services/supabase/catalog/` (browse/search/byIds/candidates/availableNow; motor puro + builder PostgREST + mock con el mismo motor); feed/mood/grupo dejan de cargar pool fijo.
- **D2-1.6** (`056b29b`): pantalla `app/explore.tsx` (chips de plataforma/género/década, lista infinita) + bloque «Dónde verla» en la ficha; capturas claro/oscuro en `docs/vertice/capturas/plan2/`.
- **D2-1.7** (`28b86ac`): atribución obligatoria de TMDB en pie de Cuenta/Perfil y páginas legales; «Datos de disponibilidad por JustWatch» en la ficha.
- **D2-1.8** (`ce83aa1`): `scripts/verify-catalog.mjs` (compara `total_results` de TMDB vs filas por proveedor, falla si faltan > 5 %) con la lógica pura testeada (`src/lib/catalogCoverage.test.ts`) + estimación de tamaño (~64 MB para ~150 k filas vs 500 MB del plan gratuito).

**Qué NO se pudo comprobar (y por qué):**
- Ids de watch-provider de TMDB: sin `TMDB_READ_TOKEN` en `.env.local` no se pudo llamar a `/watch/providers`. Los ids de los 11 proveedores activos salen del `PROVIDER_MAP` anterior (evidencia en el repo); los 5 que el plan pide pero no tenían id (`movistar-plus`, `skyshowtime`, `atresplayer`, `plex`, `youtube`) están en `PENDING_VERIFICATION` y la sync los salta. Cuando el dueño ponga el token, `node scripts/verify-catalog.mjs` lo verifica.
- Formas de respuesta de TMDB (`/discover`): tomadas de la documentación v3, **no verificadas contra la API real**.
- Supabase real: migración 0006 y función `catalog-sync` no desplegadas (producción intocable); todo probado con fixtures/simulaciones. El dueño aplica 0006 en el SQL Editor (paso 1 de su lista) y despliega la función (paso 3).

## D2-0 · Deuda inmediata — Reproducción y arreglo de la pantalla Cuenta en escritorio

### Qué se pidió
Reproducir de verdad (Playwright, escritorio 1280×720 y móvil 390×844, sesión simulada,
`hasOnboarded: true`) el informe del dueño de que en escritorio no ve «Apariencia» ni
«Cerrar sesión», y si es real arreglarlo. Añadir prueba de que a 1280×720 se llega a
«Cerrar sesión» (scrollIntoView + clic).

### Hallazgo (la causa del fallo)
El síntoma **no se reproduce en el código actual**: la pantalla Cuenta se despliega, es
desplazable y «Cerrar sesión» está alcanzable. La causa real de que nadie pudiera
comprobarlo es que **la suite E2E nunca había corrido contra un build `supabase`**:

1. `e2e/ensure-dist.mjs` reutilizaba un `dist/` **mock** con marcador `supabase`
   (la caché de Metro devolvía un bundle sin las variables `EXPO_PUBLIC_*`). El turno
   anterior lo documentó como «fallan en Windows / requieren CI», pero la causa era
   esta. **Arreglado**: `--clear` en cada build nuevo + verificación empírica del bundle
   (falla ruidoso si no lleva el entorno) + invalidación por incoherencia del marcador.
2. `supabaseMock.ts`: `.single()` se declara por cabecera `Accept: vnd.pgrst.object`
   (no por `limit=1` en la query) y los filtros implícitos `col=eq.valor` no se
   parseaban → `profiles` devolvía `[]` → perfil parcial. **Arreglado**.
3. `bootstrapUserData.ts` no normalizaba los valores remotos: un perfil con
   `favorite_platforms` `undefined` se persistía roto y en el siguiente arranque
   `useFeedData` crasheaba (`platforms.length`) → **pantalla en blanco** de la app.
   **Arreglado** con normalización + prueba nueva (`bootstrapUserData.test.ts`) que
   falla sin el arreglo.
4. `global.css`: la columna de 390 px para escritorio (A3.5) apuntaba a `#__next`; el
   root de Expo Router web es `#root`, así que la regla **nunca se aplicaba en desktop**.
   **Arreglado** (`#root`). Esta era la sospecha 2 que planteaba el plan.
5. `supabaseMock.ts` `/auth/v1/otp`: respondía 200 `text/plain` vacío; auth-js hace
   `result.json()` y fallaba. GoTrue real responde 200 con JSON. **Arreglado** a `respondJson(200, {})`.

### Prueba añadida
`e2e/account-desktop.spec.ts` (nuevo):
- Escritorio 1280×720: Cuenta despliega, la columna ≤ 390 px (A3.5), «Cerrar sesión»
  alcanzable por `scrollIntoViewIfNeeded` + visible, y un clic real cierra sesión y
  vuelve a `/login` sin errores de consola.
- Móvil 390×844: «Cerrar sesión» alcanzable.

### Líneas finales (tal cual)

`npm run verify` (tras D2-0):
```
Test Suites: 74 passed, 74 total
Tests:       431 passed, 431 total
```
`node scripts/auditoria-estilos.mjs`:
```
✓ Auditoría de estilos: todo limpio.
```
`npm run scan:secrets`:
```
✓ service_role no filtrada: 249 ficheros revisados en [app, src, public, dist]
```
`npx playwright test account-desktop.spec.ts` (D2-0):
```
  ok 1 e2e\account-desktop.spec.ts:31:5 › D2-0 escritorio 1280x720: ... (915ms)
  ok 2 e2e\account-desktop.spec.ts:59:5 › D2-0 movil 390x844: ... (669ms)
  2 passed (2.7s)
```

### Faltos E2E preexistentes (fuera de D2-0, documentados)
Al hacer que la suite E2E por fin corra contra un build real, se exponen fallos de otros
specs que **ya existían** (el turno anterior los marcó como «fallan en Windows»). No son de
la pantalla Cuenta en escritorio (D2-0) y se registran para el dueño / una tarea de E2E:
- `auth b)`: tras el canje Google, la URL conserva `?code=…` (comportamiento de auth-js).
- `auth c)`: el paso «código malo» (422 intencional) genera ruido de consola que
  `expectNoConsole` cuenta (diseño del test).
- `account d)`: `signOut` no elimina las claves `diana.*` de localStorage (hueco real
  vs. requisito D-2 d) «limpia diana.*»).
- `account e)/f)`: `strict mode violation` — locators ambiguos (`Cerrar`/`Borrar`
  resuelven a 2/3 elementos).
- `account h)`: tras `reload`, `expectInicio` no encuentra «Para ti» (revisar).
- `nomix i2)`: `SecurityError` leyendo `localStorage` tras el cierre (navegación).

**Capturas**: `test-results/d2-0-cuenta-login.png` y `test-results/d2-0-cuenta-movil.png`
(390×844 y 1280×720).

## D2-2 · Recomendador real — resumen de lo hecho

- **D2-2.1/2.2** (`788c908`, turno previo): migración `0007_recomendador.sql`
  (`catalog_features` + embedding 384-d con índice HNSW, `recommend()` y
  `predict_tenths()` con `security invoker`) **probada contra Postgres+pgvector
  local en Docker** (`node scripts/sql-recommend-local.mjs`: RLS real,
  aislamiento entre usuarios, arranque en frío).
- **D2-2.3/2.4/2.6** (`c9bdb75`):
  - Cliente: [`src/services/recommender.ts`](../../src/services/recommender.ts) —
    `activeRecommender()` (degrada a `heuristic` si `CATALOG≠tmdb`),
    `contentRecommend` (RPC `recommend`; `null` si falla → el feed cae a la
    heurística sin que el usuario lo note) y `contentPredictTenths` (RPC
    `predict_tenths`, clamp 10..50).
  - Interruptor [`EXPO_PUBLIC_RECOMMENDER`](../../src/lib/env.ts)
    (`heuristic|content`), tests `env.test.ts`.
  - **Evaluación offline** (`scripts/eval-recomendador.mjs` →
    [`evaluacion.md`](./evaluacion.md)), con **precision@10 corregido** (top-10
    real por usuario dentro del holdout, no el métrico roto de partida que
    daba 0.2 a todos):

    | Modelo | EAM (décimas) | Precisión@10 |
    |---|---|---|
    | heuristic | 5.42 | **0.569** |
    | mean | 8.803 | 0.181 |
    | random | 11.758 | 0.212 |
    | content | **3.705** | 0.444 |

    Veredicto (regla del plan: debe ganar las dos métricas): **content gana en
    EAM, la heurística gana en precisión@10** → `EXPO_PUBLIC_RECOMMENDER`
    queda `heuristic` por defecto y se documenta; el cliente degrada a
    `heuristic` si el RPC no existe (red de seguridad).
  - Tests: `recommender.test.ts`, `useFeedStore.test.ts` (content→feed,
    fallback a heurística) — 16 tests.
- **D2-2.5** (`11d6d0b`): arranque en frío — `getOnboardingDeckMovies(count,
  catalog, platforms?)` construye el mazo de títulos disponibles en las
  plataformas del usuario (completa con el resto del catálogo si hay < count
  disponibles; el contrato O2 sin plataformas es idéntico); rótulo
  «Populares en tus plataformas» en el swipe de onboarding. Tests:
  `onboardingDeck.coldstart.test.ts` (6) + `useOnboardingSwipe.test.ts` (4).

**Qué NO se pudo comprobar:** el RPC `recommend` contra Supabase real
(producción intocable) y la calidad del embedding **real** (gte-small sobre
sinopsis): la evaluación usa embeddings sintéticos deterministas del mock, que
miden la lógica del modelo (vector centrado, prior con shrinkage, umbral 20,
regresión simple), no la calidad del embedding.

## D2-3 · «Quiero ver» y listas — resumen de lo hecho

- **Migración** `0008_watchlist.sql`: tabla `(user_id, media_type, media_id,
  notes, added_at)` + RLS `watchlist_own` + índice; **0005 actualizada** con el
  borrado de `watchlist` (bloque `exception when undefined_table` para que el
  orden de despliegue no importe; 0005 es la única editable del plan).
- **Verificado contra Postgres 16 local** (`node scripts/sql-watchlist-local.mjs`,
  contenedor Docker efímero + `sql-recommend-setup.sql` con stubs
  `auth.users`/`auth.uid()`/roles `service_role bypassrls`): A lee/escribe lo
  suyo; **B no puede leer/insertar para A (42501)/actualizar/borrar** (0 filas
  vía `get diagnostics`); upsert sin duplicados; check constraint rechaza
  tipo no válido; `delete_user_data(a)` borra watchlist+profile de A y no toca
  a B. Salida final: `OK 0008/0005: watchlist RLS + borrado verificados contra
  Postgres local`.
- **Cliente**: `useWatchlistStore` (persist `diana.watchlist.v1`), repos
  mock/supabase (upsert `onConflict (user_id,media_type,media_id)` conservando
  el `added_at` local; delete por (user,tipo,id)); `index.ts` con proxy lazy
  (mock → `load()` null). **B-D9**: los fallos de red nunca bloquean la UI
  (`.catch(reportSyncError)`).
- **UI**: `WatchlistButton` (ficha + `topBadge` sobre la carta del mazo —
  `SwipeCard`/`SwipeDeck` con `pointerEvents=box-none` para no robar el gesto
  de swipe); sección «Quiero ver» en Perfil con filtro «disponible ahora en
  mis plataformas» (resolución perezosa de títulos contra
  `activeCatalogSource.byIds`).
- **Datos**: incluida en **exportar mis datos** (`export.ts`, con fallback al
  store local si la query falla por 0008 sin desplegar) y en
  `delete_user_data` (0005). `bootstrapUserData` la hidrata desde el servidor
  como fuente de verdad.
- Tests: `useWatchlistStore.test.ts` (10), `supabase/watchlist.repository.test.ts`
  (6), `WatchlistButton.test.tsx` (3) — 19 nuevos.

## D2-4 · Avisos «Ya está en tu plataforma» — resumen de lo hecho

- **Lógica pura** [`availabilityLogic.ts`](../../src/features/notifications/availabilityLogic.ts):
  compara la watchlist contra el catálogo ACTUAL con una **base guardada** por
  título (`diana.availability.baseline.v1`): solo se avisa de plataformas
  NUEVAS **propias**; primera vez solo fija la base (sin aluvión); título
  fuera del catálogo vacía la base (re-avisa si vuelve).
- **Hook** [`useAvailabilityNotifications.ts`](../../src/features/notifications/useAvailabilityNotifications.ts)
  (montado en el layout de tabs): resolución vía `byIds`, **cooldown de 1 h**
  entre comprobaciones, inactivo con `CATALOG=mock` (catálogo estático) y
  limpia de la bandeja los avisos de títulos fuera de la watchlist.
- **UI**: bandeja real en `app/notifications.tsx` (poster + «Ahora en X y Y»,
  no leídas con borde, tap → ficha, borrar todo; al abrir se marcan leídas) y
  **badge de no leídos en la campana del inicio**.
- **Propuesta Web Push SIN implementar** (como pide el plan):
  [`propuesta-web-push.md`](./propuesta-web-push.md) — VAPID + service worker
  (Android bien; iOS solo PWA instalada con matices), tablas borrador
  (`notifications`, `availability_snapshot`, `push_subscriptions`), APNs/EAS
  Push para iOS garantizado, plan de trabajo y riesgos.
- Tests: `availabilityLogic.test.ts` (10), `useNotificationTrayStore.test.ts`
  (8), `useAvailabilityNotifications.test.ts` (5) — 23 nuevos.

## D2-5 · Calidad — resumen de lo hecho

- **Módulos críticos sin test, cubiertos** (13 tests nuevos):
  `useMoodStore` (wizard, finalize ready/empty/error, carrera por requestId),
  `useSettingsStore` (persistencia v2, migración v1→v2), `useProfileStore`
  (espejo con B-D9, copias de arrays, onboarding), `rankingContext` (lectura
  sin suscripción; `unseen` no cuenta como visto),
  `supabaseProfileRepository` (load mapeado, parche parcial, onConflict PK,
  not-authenticated).
- **`docs/vertice/plan2/ARQUITECTURA.md`**: flujo catálogo →
  sincronización → cliente → recomendador + watchlist y avisos; tabla de
  degradación por entorno; mapa de tests de frontera.
- **README.md**: variables nuevas (`EXPO_PUBLIC_RECOMMENDER`,
  `TMDB_READ_TOKEN`, `CATALOG_SYNC_SECRET`), comandos nuevos
  (`eval-recomendador`, `sql-*` local, `verify-catalog`) y sección
  «Cómo lanzar la sincronización de catálogo» (solo el dueño).
- El resto de `src/` sin test (componentes UI, hooks, constantes, mocks) está
  cubierto de forma indirecta por las suites de integración existentes
  (`wireframeFacts`, `persistence`, e2e) o es datos puros; se documenta aquí
  la decisión de no forzar test de render por componente.

## Batería final (tras D2-5, tal cual)

`npm run verify`:
```
Test Suites: 95 passed, 95 total
Tests:       581 passed, 581 total
```
`node scripts/auditoria-estilos.mjs`:
```
✓ Auditoría de estilos: todo limpio.
```
`npm run scan:secrets`:
```
✓ service_role no filtrada: 290 ficheros revisados en [app, src, public, dist]
```

## Pasos del dueño (comandos exactos)

Producción intocable durante el turno: **nada** se ha desplegado. En este
orden (tras copia de seguridad de la base de Supabase):

1. **Extensiones** (Supabase → Database → Extensions): `pg_trgm`, `unaccent`,
   `vector` (pgvector).
2. **Migraciones a mano en el SQL Editor** (`supabase db push` no funciona en
   este proyecto porque 0001–0004 se aplicaron a mano; si se quiere usar,
   antes: `npx supabase migration repair`):
   ```
   supabase/migrations/0005_delete_user_data.sql   (si aún no está; ahora incluye watchlist)
   supabase/migrations/0006_catalogo.sql
   supabase/migrations/0007_recomendador.sql
   supabase/migrations/0008_watchlist.sql
   ```
3. **Edge Functions**:
   ```
   npx supabase functions deploy tmdb
   npx supabase functions deploy catalog-sync
   npx supabase secrets set CATALOG_SYNC_SECRET=<valor>   # el mismo valor, como secret de GitHub
   ```
4. **Primera sincronización completa**: GitHub → Actions → *catalog-sync* →
   **Run workflow** (workflow_dispatch). Comprobar después:
   ```
   node scripts/verify-catalog.mjs        # requiere TMDB_READ_TOKEN en .env.local
   ```
5. **Recomendador (opcional)**: con 0007 desplegado, decidir
   `EXPO_PUBLIC_RECOMMENDER=content` (hoy `heuristic` por el veredicto de la
   evaluación; el cliente degrada solo si el RPC falla).
6. `git push` (CI: verify + build + Pages en `/diana`).
7. (D2-1, si aún no) `npx supabase functions deploy delete-account` y
   re-ejecutar `npm run rls` cuando 0005 esté desplegada (con respaldo
   reciente; ver README «Cuándo es seguro ejecutar npm run rls»).
8. (D2-4, opcional) Web Push: ver
   `docs/vertice/plan2/propuesta-web-push.md` (no se implementó).

## Lo que NO se pudo comprobar contra servicios reales (resumen)

- **TMDB real**: sin `TMDB_READ_TOKEN` en `.env.local` no se llamó a la API
  (ids de proveedores pendientes de verificar siguen en `PENDING_VERIFICATION`;
  `verify-catalog.mjs` queda listo para el paso 4).
- **Supabase real**: 0005 (nueva versión), 0006, 0007 y 0008 **no
  desplegadas** (producción intocable). Todo lo SQL se probó contra Postgres
  16 local en Docker (RLS real de usuarios, borrado por usuario, upsert); los
  repos Supabase, con mocks del cliente.
- **Embedding real (gte-small)**: la evaluación del recomendador usa
  embeddings sintéticos; la calidad del embedding real solo se mide en
  producción tras la primera sync con features.
- **Avisos**: la detección es client-side con cooldown de 1 h (la sync es
  diaria); el push real no se implementó (propuesta documentada).
- **iPhone/PWA instalada**: nada se pudo probar en dispositivo real (e2e
  cubre web; el guion D5 del plan queda para el dueño).
