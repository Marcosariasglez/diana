# PLAN · Correcciones Prioritarias (Fase 2)

> Rama sugerida: `vertice/fix-prioridades` desde `main`
> Regla de oro: tests primero (fallan sin el cambio), batería tras cada tarea (`npm run verify` + `node scripts/auditoria-estilos.mjs`), commits pequeños en español, **NO hacer push** (avisar al dueño antes).

---

## Problema 1 — Series/cortos/documentales sin título ("Película 8765", "Este título no existe")

**Causa raíz (diagnosticada):**
- `src/services/supabase/catalog/mapper.ts:60`: usa `row.title || row.original_title || 'Película ${row.tmdb_id}'` para películas y `row.title || row.original_title || 'Serie ${row.tmdb_id}'` para series. Los títulos llegan vacíos cuando el sync solo guarda `original_title`.
- `src/services/recommender.ts:132-135`: `mediaFromRpcRow` construye Media desde el RPC `recommend` pero usa `row.title` directamente sin fallback a `original_title`.
- La ficha de detalle (`app/detail/[id].tsx`) no existe como ruta stack (está en `app/(tabs)/explore.tsx` → `detail/[id]`). El catálogo mock (`src/mocks/data/catalog.ts:444`) tiene `titleOf` que distingue `media_type === 'movie'` vs `tv`.
- `src/services/supabase/catalog/mapper.ts:60`: **todos** los tipos usan `media_type: 'movie'` en el mapper; las series/documentales/cortos se pierden el campo `name`.

### Tareas

- [ ] **1.1** Arreglar `mediaFromRpcRow` en `src/services/recommender.ts` (líneas 110-135):
  - Soportar `media_type: 'tv'` correctamente: asignar `name` (no `title`) para series, usando `row.title || row.original_title || 'Serie ${row.tmdb_id}'`.
  - Asegurar que `row.title` tenga fallback a `row.original_title` cuando esté vacío.
  - Tests: `recommender.test.ts` — caso TV con `title: '', original_title: 'Nombre Real'` → `name === 'Nombre Real'`.

- [ ] **1.2** Arreglar `rowToMedia` en `src/services/supabase/catalog/mapper.ts` (líneas 36-61):
  - Para `media_type === 'tv'`: `name: row.title || row.original_title || 'Serie ${row.tmdb_id}'`.
  - Para `media_type === 'movie'`: `title: row.title || row.original_title || 'Película ${row.tmdb_id}'`.
  - Verificar que el campo usado por `mediaTitle()` (`media.media_type === 'movie' ? media.title : media.name`) siempre devuelve texto no vacío.
  - Tests: `catalog.paginated.test.ts` (línea 205) — caso TV con `title: null` → `name` no vacío.

- [ ] **1.3** Verificar que la ficha de detalle resuelve `media_type === 'tv'` correctamente (si existe `app/detail/[id].tsx`, revisar `getMediaById` del repositorio: `src/services/supabase/catalog/engine.ts`). Si falta, añadir fallback para que no muestre "Este título no existe" con series del catálogo real.

---

## Problema 2 — Incluir cortos y documentales en el catálogo

**Causa raíz (diagnosticada):**
- `catalog-sync` y `catalog-features` solo consultan `primary_media_type IN ('movie','tv')` en TMDB.
- El catálogo de producción (`catalog_titles`) no tiene `primary_media_type` (o sí?) — hay que verificar.

### Tareas

- [ ] **2.1** Verificar la columna `primary_media_type` en `catalog_titles` (producción):
  - `node scripts/.tmp-p0.mjs` o similar probe anon → `select distinct primary_media_type from catalog_titles`.
  - Si NO existe la columna → crear migración `0022_catalog_types.sql`: `ALTER TABLE catalog_titles ADD COLUMN primary_media_type TEXT DEFAULT 'movie' CHECK (primary_media_type IN ('movie','tv','short','documentary'))`.
  - Si YA existe → saltar a 2.2.

- [ ] **2.2** Actualizar `catalog-backfill` y `catalog-features` (`supabase/functions/catalog-features/index.ts`, `supabase/functions/catalog-backfill/index.ts` si existe):
  - Cambiar la consulta TMDB para incluir `primary_media_type IN ('movie','tv','short','documentary')`.
  - Guardar `primary_media_type` en el upsert de `catalog_titles`.
  - Tests: `catalog-features.test.ts` → verificar que las fixtures incluyen `short` y `documentary`.

- [ ] **2.3** Actualizar `rowToMedia` en `mapper.ts` y `mediaFromRpcRow` en `recommender.ts`:
  - Soportar `primary_media_type` como campo adicional en el Media (o usarlo para filtrar).
  - La interfaz `Media` (`src/types/media.ts`) puede necesitar `primary_media_type?: 'movie' | 'tv' | 'short' | 'documentary'`.

- [ ] **2.4** Verificar que el feed y explorar no filtren por `media_type === 'movie'` excluyendo cortos/documentales (buscar `.filter(m => m.media_type === 'movie')` en `catalog/engine.ts`, `onboardingDeck.ts`, `moodFilters.ts`).

---

## Problema 3 — Columnas de explorar desalineadas (cortadas por la izquierda, hueco a la derecha)

**Causa raíz (diagnosticada):**
- `app/(tabs)/explore.tsx` usa `FlashList` con `numColumns={3}` y un estilo de celda que probablemente no calcula bien el padding horizontal.
- El grid debe centrarse: el padding total de la pantalla (390px) menos el ancho total de las 3 columnas debe repartirse equitativamente.

### Tareas

- [ ] **3.1** Analizar el estilo del grid en `app/(tabs)/explore.tsx` (líneas ~108-120):
  - Revisar `numColumns`, `estimatedItemSize`, `contentContainerStyle`, y el estilo de cada celda (`styles.cell`).
  - Identificar por qué la primera columna queda cortada (padding-left excesivo o missing `paddingHorizontal`).

- [ ] **3.2** Centrar el grid:
  - Opción A: usar `contentContainerStyle={{ paddingHorizontal: 20 }}` en el FlashList y ajustar el ancho de cada celda.
  - Opción B: usar `gap` + `paddingHorizontal` en el contenedor.
  - Verificar visual: la primera celda debe estar alineada con el texto de la cabecera (margen 20px estándar) y la última celda debe quedar simétrica.

- [ ] **3.3** Captura de verificación (opcional pero recomendada): screenshot de la pantalla Explorar en 390×844.

---

## Problema 4 — Buscador y filtros múltiples en Explorar

**Estado actual:**
- `app/(tabs)/explore.tsx`: usa chips de plataforma (`PLATFORMS`) y géneros (`genresChips`), más décadas (`DECADES`). Todos son **single-select** (un chip por vez).
- No hay buscador.
- Las décadas aparecen dentro de la sección de géneros (deben ir en su propia sección).

### Tareas

- [ ] **4.1** Añadir buscador (input de texto) en la cabecera de Explorar:
  - Componente: reusar `TextField` o `SearchBar` (`src/components/ui/SearchBar.tsx` si existe).
  - Debounce: `useDebounce` (`src/hooks/useDebounce.ts`).
  - Conectar al motor de búsqueda: `catalogRepository.search()` o la función equivalente en `src/services/supabase/catalog/engine.ts`.

- [ ] **4.2** Convertir filtros de plataforma a **multi-select**:
  - Cambiar los pills/chips de plataforma para permitir selección múltiple (`PillGroup` o `Chip` con estado activo).
  - El estado de filtros: `useState<string[]>([])` para plataformas seleccionadas.
  - Al cargar resultados: filtrar por `platforms.some(p => selectedPlatforms.includes(p))`.

- [ ] **4.3** Convertir filtros de género a **multi-select**:
  - Mismo patrón que plataformas.
  - Separar visualmente: sección "Géneros" (chips multi-select) y sección "Décadas" (chips multi-select).

- [ ] **4.4** Separar décadas de géneros:
  - Nueva sección `DECADES` (o `AÑOS`) con chips multi-select independientes.
  - Reestructurar el layout de filtros: [Plataformas] → [Géneros] → [Décadas].

- [ ] **4.5** Lógica de filtrado combinado:
  - Todos los filtros activos se aplican conjuntamente (AND entre categorías, OR dentro de cada categoría).
  - Ejemplo: (Netflix O Prime) AND (Acción O Comedia) AND (2010s) = títulos que cumplen TODAS las condiciones.
  - El feed infinito (FlashList) debe respetar los filtros activos.

- [ ] **4.6** Reset de filtros: botón "Limpiar" o "×" para volver al estado sin filtros.

---

## Problema 5 — Mood: sin resultados o devuelve series cuando pide películas

**Causa raíz (diagnosticada):**
- `src/mocks/mock-ai/moodFilters.ts:108-110`: filtra por `media_type === 'movie'` pero luego aplica filtros de género/año que pueden dejar el pool vacío.
- El modo content (`recommend` RPC) puede devolver series si no hay filtro de `primary_media_type`.
- No hay fallback: cuando el pool es vacío, se muestra "no hay películas" en vez de relajar filtros.

### Tareas

- [ ] **5.1** Añadir filtro `primary_media_type` al RPC `recommend` y al pool de mood:
  - En `useFeedStore.ts` y `moodFilters.ts`: pasar `type: 'movie'` (o `primary_media_type`) explícitamente.
  - En el modo content: `contentRecommend({ platforms, type: 'movie', ... })`.
  - Tests: `useFeedStore.test.ts` → verificar que los resultados del RPC solo incluyen películas.

- [ ] **5.2** Fallback de filtros en mood (garantizar siempre resultados):
  - Si el pool después de aplicar TODOS los filtros es vacío → relajar progresivamente:
    1. Quitar filtro de década más restrictivo.
    2. Quitar filtro de plataforma menos popular.
    3. Ampliar rango de géneros.
  - Mostrar mensaje al usuario: "Mostrando resultados ampliados" (opcional).
  - Tests: `moodFilters.test.ts` → caso con filtros incompatibles → debe devolver >0 resultados.

- [ ] **5.3** Verificar que las series NO aparezcan en los resultados de mood:
  - Añadir assert en los tests: `results.every(m => m.media_type === 'movie')`.
  - Revisar `getMoodResults` en `catalog/engine.ts` o `mock-ai/moodFilters.ts`: confirmar que el filtro `media_type === 'movie'` se aplica ANTES de cualquier otro filtro.

- [ ] **5.4** Mejorar el mensaje "no hay películas" → si el fallback no puede encontrar nada (catalog vacío o sin features), mostrar "Intenta con otros filtros" en vez de pantalla vacía.

---

## Problema 6 — Perfil: sección "Mis listas", historial colapsable, diario

**Estado actual:**
- `app/(tabs)/profile.tsx` muestra "Historial" con todas las entradas (lista larga).
- No hay sección "Mis listas" (watchlist).
- No hay sección "Diario" (daily-log).

### Tareas

- [ ] **6.1** Sección "Mis listas" (watchlist) en Perfil:
  - Reusar `WatchlistSection` (`src/features/profile/WatchlistSection.tsx` si existe) o crear un componente.
  - Mostrar los títulos de la watchlist del usuario (desde `useWatchlistStore`).
  - Click en un título → ir a la ficha (`/detail/[id]`).
  - Estado vacío: "Aún no tienes listas" + botón "Explorar".

- [ ] **6.2** Historial colapsable (5 últimas + "Ver todo"):
  - Modificar la sección de historial en `profile.tsx`:
    - Mostrar solo las **5 últimas** entradas (`useHistoryStore.getState().entries.slice(0, 5)`).
    - Botón "Ver todo el historial" → navegar a pantalla de historial completo (si no existe, crear `app/history.tsx` o reusar un BottomSheet).
  - Componente: `HistoryRow` (`src/components/ui/HistoryRow.tsx`) para cada entrada.

- [ ] **6.3** Sección "Diario" en Perfil:
  - Diferenciar: el diario (`daily-log`) registra películas vistas **con fecha** (añadidas desde el `+`).
  - Las importaciones de Letterboxd NO van al diario (van al historial, sin fecha visible).
  - Mostrar las últimas entradas del diario (5 recientes) con su fecha: "12 oct · Película X".
  - Botón "Ver todo el diario" → `/daily-log`.
  - Dato: consultar `history_entries` filtrando por `source = 'manual'` (o equivalente: las entradas añadidas desde la app, no importadas).

- [ ] **6.4** Layout de Perfil: reorganizar las secciones:
  1. Cabecera (nombre, avatar).
  2. "Mis listas" (watchlist).
  3. "Historial" (colapsable, 5 últimas).
  4. "Diario" (con fecha, 5 recientes).
  5. Configuración / Perfil / Cerrar sesión.

---

## Checklist de verificación final (antes de entregar)

- [ ] `npm run verify` → 0 errores typecheck + lint + todos los tests verdes.
- [ ] `node scripts/auditoria-estilos.mjs` → todo limpio.
- [ ] `npm run scan:secrets` → limpio.
- [ ] Verificación visual en la app (web, build local):
  - [ ] Series/documentales muestran nombre real en el feed.
  - [ ] Click en serie → ficha se abre (no "no existe").
  - [ ] Explorar: grid centrado, buscador funcional, filtros multi-select, décadas en sección propia.
  - [ ] Mood: siempre devuelve resultados, nunca devuelve series cuando pide películas.
  - [ ] Perfil: sección "Mis listas", historial colapsable, diario con fechas.
- [ ] **NO hacer push.** Avisar al dueño antes de cualquier push.
