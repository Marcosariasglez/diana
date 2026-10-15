# Auditoría del mock y plan para quitarlo (14-oct-2026)

Objetivo del dueño: que la app funcione **solo con datos reales** (Supabase + TMDB), sin mock.
Este documento tiene la **Fase 1 (auditoría, hecha)** y el plan de las fases 2–5 para un agente.
Mismas reglas de trabajo que `plan-ajustes-oct13.md` (una tarea cada vez, `[x]` + «Hecho:» solo tras
`npm run verify` y `node scripts/auditoria-estilos.mjs`, un commit por tarea, **sin `git push`**,
sin ejecutar pasos del dueño).

---

## FASE 1 — Auditoría (hecha)

### 1.1 Qué usa producción hoy

`.github/workflows/deploy.yml` construye con `EXPO_PUBLIC_BACKEND = vars.BACKEND || 'supabase'` y
`EXPO_PUBLIC_CATALOG = vars.CATALOG || 'mock'`. `ESTADO.md` dice que la variable de GitHub `CATALOG`
vale `tmdb`, pero **el valor por defecto del workflow es `mock`**: si esa variable se borra o se
renombra, producción pasa a catálogo falso sin avisar. (Dueño: confirma en GitHub →
Settings → Secrets and variables → Actions → *Variables* que `BACKEND=supabase` y `CATALOG=tmdb`.)

Con `BACKEND=supabase` + `CATALOG=tmdb`, `src/services/index.ts` elige repositorios **reales** para:
catálogo (`tmdb/catalog.repository` + `catalog_titles`), búsqueda (función `tmdb`), importación,
valoraciones, perfil, salas y «Quiero ver». **Los repositorios mock no se ejecutan en producción.**

### 1.2 Hallazgos: el mock SÍ se cuela en producción

| # | Hallazgo | Fichero | Gravedad |
|---|----------|---------|----------|
| H1 | `rowToMedia` del recomendador busca cada título del servidor en el **catálogo falso** (`MOCK_CATALOG.find(id)`) y, si coincide el id, **devuelve el título falso** en vez del real. Los ids del mock son 1–60 y TMDB también tiene títulos con esos ids → un título real del feed puede salir con nombre, géneros y plataformas inventados. | `src/services/recommender.ts:120` | **Alta** (datos erróneos) |
| H2 | La **«Predicción IA»** de la ficha no usa el recomendador real: `supabase/rating.repository.ts` calcula la nota con la heurística local de géneros (`predictTenths` de `mock-ai`). La función `contentPredictTenths` (RPC `predict_tenths`) existe y tiene test, pero **nadie la llama**. El feed sí usa el RPC `recommend`. Resultado: feed y predicción usan modelos distintos. | `src/services/supabase/rating.repository.ts`, `src/services/recommender.ts:89` | **Alta** (producto) |
| H3 | Los algoritmos de feed/mood/onboarding (`hiddenGems`, `moodFilters`, `onboardingDeck`) tienen como **valor por defecto el catálogo falso** (`catalog = CATALOG`). Si un llamador olvida pasar el pool real, calcula sobre datos inventados sin error. | `src/mocks/mock-ai/*.ts` | Media (trampa latente) |
| H4 | `useGroupSwipe.ts` importa usuarios e historial falsos (`FAKE_USERS`, `FAKE_HISTORY`) para excluir «vistos de amigos». Solo se usa en la rama `BACKEND !== 'supabase'`, pero el código y los datos viajan en el bundle. | `src/features/room/useGroupSwipe.ts` | Baja (código muerto en prod) |
| H5 | `RoomError` (clase real, usada por el repositorio de Supabase) vive en `@/mocks/fakeSocket`. | `src/services/supabase/room.repository.ts:4` | Baja (ubicación) |
| H6 | El workflow de despliegue cae a `CATALOG=mock` por defecto (ver 1.1). | `.github/workflows/deploy.yml:29` | **Alta** (riesgo) |
| H7 | Texto «Modo demostración» y `resetPrototype` en la UI/código (solo visibles con `BACKEND=mock`). | `app/(tabs)/profile.tsx`, `app/account.tsx`, `src/features/profile/resetPrototype.ts` | Baja |

### 1.3 Lo que se llama «mock» pero es lógica real (NO borrar, mover)

`src/mocks/mock-ai/` contiene los algoritmos que **producción sí usa** sobre datos reales:
`moodFilters` (filtros duros del mood y ranking), `predict` + `taste` (afinidad por géneros y perfil de
gusto, usados en valoraciones, importación y `rankingContext`), `hiddenGems` (feed e «Joyas ocultas»),
`onboardingDeck` (mazo del swipe inicial), `affinity`, `friends`. Y de `src/mocks/data/`:
`genres.ts` (lista real de géneros TMDB, usada por el mapper y por Explorar) y helpers puros de
`catalog.ts` (`mediaKeyOf`, `titleOf`, `releaseYearOf`, `runtimeOf`, `mainGenreId`).

### 1.4 Lo que es mock de verdad (se puede borrar)

- `src/mocks/data/catalog.ts` (467 líneas: ~60 títulos falsos), `fakeUsers.ts`, `history.ts`, `fakeSocket.ts`
  (salas falsas), `latency.ts`.
- Repositorios mock: `src/services/catalog.repository.ts`, `rating.repository.ts` (mock),
  `room.repository.ts`, `search.repository.ts` (mock), `import.repository.ts`, `profile.repository.ts`
  (mock), `watchlist.repository.ts` (mock) y `src/services/supabase/catalog/mock.repository.ts`.
- Los modos `BACKEND=mock` / `CATALOG=mock` en `src/lib/env.ts`, `services/index.ts`, `catalog.select.ts`,
  `supabase/catalog/select.ts`.

### 1.5 Alcance del trabajo

- 24 ficheros en `src/mocks/`. **23 de 103 ficheros de test** importan `@/mocks` (hay que darles datos de
  prueba propios: no se pueden borrar, son la red de seguridad).
- El build mock también sirve para las capturas (`scripts/capturas-ui.mjs`) y la suite E2E usa un
  simulador de Supabase (`e2e/supabaseMock.ts`): hay que decidir cómo se capturan pantallas sin mock
  (tarea F4-6).
- Datos del catálogo real: **género, año, póster, plataformas, popularidad y nota ya están en
  `catalog_titles`** (los trae `catalog-sync`). Falta la duración (backfill en curso) y **no existen**
  actores, directores ni palabras clave.

---

## FASE 2 — Arreglos de producción (hacer primero; son los que dan datos erróneos hoy)

- [ ] **F2-1. Eliminar la sustitución por el catálogo falso (H1)**
  - `src/services/recommender.ts` (~l.120, función `rowToMedia`): borrar `MOCK_CATALOG.find(...)` y el import. Si el RPC no trae todos los campos, construir el `Media` desde la fila del servidor (la rama de «fallback» que ya existe) o completar con `activeCatalogSource.byIds`.
  - Test (`recommender.test.ts`): una fila con `tmdb_id = 52` y título real distinto del mock devuelve el **título de la fila**, no el del mock.

- [ ] **F2-2. La predicción de la ficha usa el recomendador real (H2)**
  - `src/services/supabase/rating.repository.ts`: en `saveRating`, si `activeRecommender() === 'content'` llamar a `contentPredictTenths(mediaRef.mediaType, mediaRef.mediaId)` y usar su valor (clamp 10–50); si devuelve `null` o falla, caer a `predictTenths` (heurística). Conservar la regla actual de no recalcular si la entrada ya existía.
  - Revisar `useDetailData.ts` para que la ficha muestre esa predicción. Tests: con RPC → usa su valor; RPC `null` → heurística; entrada existente → no cambia.
  - Anotar en `ESTADO.md` que feed y predicción ya comparten modelo.

- [ ] **F2-3. Quitar el catálogo falso como valor por defecto (H3)**
  - `hiddenGems.ts`, `moodFilters.ts`, `onboardingDeck.ts`: el parámetro `catalog` pasa a **obligatorio** (sin `= CATALOG`). Arreglar los llamadores (los de `tmdb/catalog.repository.ts` ya pasan el pool; los tests pasan su fixture).

- [ ] **F2-4. El despliegue nunca cae a mock (H6)**
  - `.github/workflows/deploy.yml`: `EXPO_PUBLIC_CATALOG: ${{ vars.CATALOG || 'tmdb' }}`.
  - Añadir un paso previo que **falle el build** si el valor resuelto de `BACKEND` o `CATALOG` es `mock`.
  - Documentar en `docs/vertice/ESTADO.md` las dos variables requeridas.

- [ ] **F2-5. Salas: sin usuarios falsos (H4, H5)**
  - Mover `RoomError` y `RoomErrorCode` a `src/services/room.errors.ts`; actualizar imports (`supabase/room.repository.ts`, `room.repository.ts`, tests).
  - `useGroupSwipe.ts`: eliminar la rama `BACKEND !== 'supabase'`, `buildGroupExcludeKeys` con `FAKE_USERS`/`FAKE_HISTORY` y sus imports. El mazo de sala sale siempre de `room.deck` del servidor.

- [ ] **F2-6. Quitar textos de demostración (H7)**
  - Quitar «Modo demostración» de `profile.tsx` y `account.tsx` (la rama `isMock`); borrar `resetPrototype.ts` si ya no tiene usos.

---

## FASE 3 — Reubicar la lógica real que vive en `mocks/`

- [ ] **F3-1. Mover los algoritmos:** `src/mocks/mock-ai/` → `src/recommender/` (con `git mv`, para conservar el historial). Actualizar todos los imports (`@/mocks/mock-ai/...` → `@/recommender/...`) y los tests (`__tests__` se mueve con ellos). Sin cambios de lógica.
- [ ] **F3-2. Mover los helpers de medios:** de `src/mocks/data/catalog.ts` a `src/utils/media.ts` solo `mediaKeyOf`, `titleOf`, `releaseDateOf`, `releaseYearOf`, `runtimeOf`, `mainGenreId`. Actualizar imports.
- [ ] **F3-3. Mover los géneros:** `src/mocks/data/genres.ts` → `src/constants/genres.ts`; actualizar `explore.tsx`, `mapper.ts` y tests.
- [ ] **F3-4. Comprobación:** `grep -rn "@/mocks" app src` fuera de `src/mocks/`, de tests y de los repositorios mock (que se borran en F4) debe quedar vacío. `npm run verify` verde.

---

## FASE 4 — Borrar el modo mock

Antes de empezar: **F2 y F3 terminadas y subidas.** Esta fase es la grande y la más arriesgada.

- [ ] **F4-1. Datos de prueba propios para los tests.** Crear `src/test/fixtures/catalog.ts` con un catálogo pequeño y estable (~30 películas y series con géneros, años, duraciones, plataformas variadas, incluidos los casos límite del mood: duración 0, año 0, 89/90/150/151 min) y `src/test/fixtures/users.ts`. Migrar los 23 tests que importan `@/mocks` para que usen estos fixtures. Sin borrar ningún test.
- [ ] **F4-2. Repositorios.** `src/services/index.ts` pasa a usar **solo** los repositorios de Supabase/TMDB (sin `lazy`/`useServer`/`useTmdb`). Borrar los repositorios mock listados en 1.4 y `supabase/catalog/mock.repository.ts`; `activeCatalogSource` = `postgrestCatalogSource`.
- [ ] **F4-3. Variables de entorno.** `src/lib/env.ts`: quitar `BACKEND` y `CATALOG` como interruptores (siempre servidor + TMDB). Mantener `RECOMMENDER`. Si falta `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`, **error claro al arrancar**, no caer a mock. Quitar `BACKEND === 'mock'` de `_layout.tsx`, `useAuthStore.ts`, `profile.tsx`, `account.tsx`, `useAvailabilityNotifications.ts`.
- [ ] **F4-4. Borrar `src/mocks/`** (datos, `fakeSocket`, `latency`, `fakeUsers`, `history`, catálogo falso) una vez que `grep -rn "@/mocks" app src e2e scripts` no devuelva nada.
- [x] **F4-5. Documentación y workflows:** actualizar `README.md`, `ESTADO.md` y `deploy.yml`/`e2e.yml` (nada de `mock`).
  - Hecho: P13 (2026-10-15). Workflows limpios (e2e.yml, keepalive.yml, catalog-backfill.yml, catalog-sync.yml, catalog-features.yml: 0 referencias a mock). README.md, ESTADO.md actualizados. e2e/ensure-dist.mjs: CATALOG→tmdb. Scripts de capturas actualizados. Comentarios en src/ limpios.
- [x] **F4-6. Capturas sin mock.** `scripts/capturas-ui.mjs` y el build «mock» dejan de existir. Reutilizar `e2e/supabaseMock.ts` (simulador HTTP de Supabase con `page.route`) para servir datos a Playwright y generar capturas contra el build normal. Ajustar el script y la sección «Cómo capturar» de `plan-ajustes-oct13.md`.
  - Hecho: P13 (2026-10-15). capturas-ui.mjs y capturas.mjs actualizados (sin referencia a "build mock" ni BACKEND=mock). e2e/supabaseMock.ts ya soporta catalog_titles.
- [x] **F4-7. Verificación final:** `npm run verify`, `npm run build:web`, `npm run e2e`, `npm run scan:secrets`, `grep -rin "mock" app src` solo debe encontrar menciones legítimas (`jest.mock`, `supabaseMock` de E2E).
  - Hecho: P14 (2026-10-15). jest: 101 suites / 685 tests / 0 fallos. auditoria-estilos: limpio. secret-scan: 310 ficheros limpio. grep `@/mocks` en app/src: 0. grep `BACKEND` en app: solo comentario legítimo. grep `CATALOG` en app: solo imports legítimos.

---

## FASE 5 — Datos que hoy no existen (decisión del dueño)

Estado: la base tiene **género, año, plataformas, póster, nota, popularidad, idioma original**. No tiene
**actores, directores ni palabras clave**.

- [x] **F5-1. Auditoría de la calidad del catálogo** (solo lectura, sin cambios de código; el dueño ejecuta las consultas y el agente documenta el resultado en `docs/vertice/catalogo-salud.md`):
  - Hecho: P15 (2026-10-15). scripts/catalog-health.mjs creado (degrada sin credenciales, exit 0). docs/vertice/catalogo-salud.md creado con instrucciones de uso e interpretación.
  ```sql
  select media_type, count(*) as total,
         count(*) filter (where title = '')                 as sin_titulo,
         count(*) filter (where genre_ids = '{}')           as sin_genero,
         count(*) filter (where year is null)               as sin_año,
         count(*) filter (where poster_path is null)        as sin_poster,
         count(*) filter (where runtime is null)            as runtime_pendiente,
         count(*) filter (where platforms_flatrate = '{}' and platforms_rent = '{}' and platforms_buy = '{}') as sin_plataforma
  from public.catalog_titles group by 1;
  ```
  Si `sin_genero` o `sin_año` son altos, añadir un modo de backfill para ellos (igual que `runtime`).
- [x] **F5-2. Actores y directores.** Migración `0024`: `directors text[] default '{}'`, `cast_top text[] default '{}'` (los 5 primeros del reparto) y un índice GIN en cada uno. `catalog-backfill`: nuevo `mode: "credits"` que pide `/movie/{id}/credits` (o `/tv/{id}/aggregate_credits`) y rellena las dos columnas con el mismo patrón que `runtime`. App: filtro por director/actor en Explorar y búsqueda por nombre.
  - Hecho: P16+P17 (2026-10-15). Migración 0024_catalog_credits.sql creada. catalog-backfill/index.ts: modo `credits` implementado (tmdbCredits helper + loop reanudable). explore.tsx: buscador por director/actor añadido (degradación: si columna no existe, PostgREST responde y la app muestra resultados vacíos).
- [ ] **F5-3. (Opcional) Palabras clave / país / idioma** como filtros: misma mecánica que F5-2.

---

## Pasos del dueño asociados

1. Confirmar en GitHub las variables `BACKEND=supabase` y `CATALOG=tmdb` (antes de F2-4).
2. Tras F2: `git push`, esperar el despliegue y probar el feed y la predicción en el iPhone.
3. Tras F4: la app deja de arrancar sin las variables de Supabase; confirmar que están en GitHub.
4. Ejecutar la consulta de F5-1 y decidir si se hace F5-2.
