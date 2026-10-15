# PLAN · Rediseño de Inicio y Explorar

> Rama sugerida: `vertice/rediseno-inicio-explorar` desde `main`.
> Regla de oro (igual que `fix-prioridades.md`): tests primero (que fallen sin el cambio), batería tras cada tarea (`npm run verify` + `node scripts/auditoria-estilos.mjs`), commits pequeños en español, **NO hacer push** sin avisar al dueño.
> Mockups de referencia: `plans/rediseño-inicio-explorar-propuestas.html` (abrir en el navegador). Elegido: **Inicio = mezcla A + B**, **Explorar = A**.

---

## 0. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Inicio | Mezcla de A (hero grande, Top 10 con número grande, filas limpias) y B (cabecera actual «Para ti» + campana, pills de plataforma, títulos y año bajo cada póster, razón visible en cada bloque). |
| Nota IA | **Nunca se muestra** en Inicio ni en Explorar: ni décimas, ni estrellas estimadas, ni % de afinidad. Es sorpresa. Solo se permite lo que ya existe: `LockedAffinityChip` («Match alto/medio» con candado) y la explicación textual. |
| Explorar | Propuesta A: un buscador único con botón de filtros dentro, filtros en `BottomSheet`, chips activos debajo, rejilla que ocupa el resto. |
| Estilo | Se mantiene el sistema actual: tokens de `src/theme/tokens.ts`, `textStyle()` de `typography.ts`, `SHADOWS.card`, `useThemedStyles`, Manrope + Inter, radios 12/16/24, iconos `lucide-react-native`. **Ningún color suelto en pantallas** (lo vigila `auditoria-estilos.mjs`). El hero NO va a sangre completa: es una tarjeta grande con el margen lateral de 20 px, como el `FeaturedMatchCard` actual. |
| Sin artifacts | Mockups y planes viven en local (`plans/`). |

### Lo que el código impone (diagnóstico de la Fase 1)

1. **El RPC `recommend` solo explica «Porque te gustó X»** (`supabase/migrations/0021_recommend_plpgsql_branch.sql:241-255`). No devuelve `tenths` ni `bucket`; el bucket se calcula en cliente (`bucketFromScore`, `src/store/useFeedStore.ts:9`). Las razones «género» y «época» hay que construirlas (§3.2).
2. **Las filas del RPC llegan sin datos** (`mediaFromRpcRow`, `src/services/recommender.ts:110`): sin géneros, año, backdrop ni plataformas. Hace falta un enriquecimiento por lotes con `byIds` (2 consultas: movie + tv).
3. **El feed de contenido no pagina** (`useFeedStore.ts:104-115`): hoy enseña 1 destacado + 5 recomendaciones de 60 candidatos. Se desperdician 54.
4. **Explorar: el buscador de créditos está muerto.** `debouncedCreditQuery` (`app/(tabs)/explore.tsx:52`) nunca llega a `fetchPage`. Las columnas `directors`/`cast_top` (0024) ya existen con GIN.
5. **Géneros múltiples se filtran en cliente** sobre páginas de 20 (`explore.tsx:99-101`), lo que da páginas cortas o vacías. `BrowseParams` solo acepta un `genre`.
6. **`search` ignora género, década y tipo** (`buildSearchQuery`, `query.ts:101`): con texto, los filtros de género/década desaparecen.
7. No hay preferencia de época en el perfil (`TasteProfile` solo tiene `weightBp` por género; `HistoryEntry` no guarda año). La razón «época» se deriva de los años de lo que has valorado alto (§3.2).
8. Hay `react-native-svg` 15 instalado: sirve para el número con contorno del Top 10 (RN no soporta `-webkit-text-stroke`).

---

## 1. Diseño final

### 1.1 Inicio (`app/(tabs)/index.tsx`)

De arriba abajo:

1. **Cabecera** (se mantiene): «Para ti» (`screenTitle`) + campana con badge.
2. **Pills de plataforma** (se mantienen, `PillGroup` scrollable).
3. **HeroCarousel «Para ti»** (de A): 5 tarjetas paginadas horizontalmente (ancho = pantalla − 40, alto ≈ 440 en 375 px). Cada tarjeta:
   - Backdrop (o póster `giant` si no hay backdrop) con degradado a `colors.card` en la parte baja.
   - Eyebrow `label`: «PARA TI».
   - Título `heroTitle`, meta `bodySmall` en `textSecondary`: «2022 · Drama · 1 h 42 min».
   - **ReasonLine** (icono `Sparkles` 14 px + texto en `acc`): «Porque te gustó Past Lives» / «Porque te gusta el drama» / «Porque buscas cine de los 90».
   - `LockedAffinityChip` (sin cambios: candado, sin número).
   - Botones: `Button` primario «Ver ficha» + `WatchlistButton`.
   - Indicador de página (dots) debajo del carrusel.
4. **Top 10 para ti** (de A, pedido explícito): fila horizontal; cada ítem = número 1–10 grande (Manrope ExtraBold ~110 px, SVG con trazo `lineStrong` y relleno transparente) pegado a la izquierda de un póster `medium` (120×180) que lo solapa ~16 px. Debajo del póster: título (1 línea, `posterTitle`). Sin nota.
5. **Filas por categoría** (B en contenido, A en sobriedad): `PosterCarousel` con
   - título de sección + **subtítulo de razón** (`bodySmall`, `mut`): «Porque te gustó Sicario», «Basado en tus valoraciones de thriller»;
   - póster `medium`, título y **año** debajo (B), `LockedAffinityChip` cuando el bucket no es `bajo` (como hoy);
   - «Ver todo» cuando la fila tiene más de lo que se ve.
6. Filas que se piden de forma progresiva al hacer scroll (como el `loadMore` actual), con mezcla de personalizadas y variadas (ver §3.3).

Estados: skeleton (hero 440 + 2 filas), sin plataformas (`EmptyState` actual), error total (`ErrorState`), error parcial de fila (fila oculta + log, no rompe el feed).

### 1.2 Explorar (`app/(tabs)/explore.tsx`)

1. **Cabecera**: «Explorar» (`screenTitle`). Desaparece el botón «Limpiar» de la cabecera (pasa a los chips).
2. **UnifiedSearchBar**: el `SearchBar` actual con un accesorio a la derecha: botón cuadrado 38×38 (`chip` de fondo, radio 10) con icono `SlidersHorizontal` y badge `acc` con el nº de filtros activos. Placeholder: «Película, director, actor, género…».
3. **Sugerencias de filtro** (solo mientras se escribe, una fila): si el texto coincide con un género, plataforma, década/año o tipo, aparece un chip «+ Género: Thriller» / «+ Netflix» / «+ Años 90». Al tocarlo se convierte en filtro y se quita esa palabra del texto. Así el buscador único cubre título, director, actor (servidor) y género/año/plataforma (cliente).
4. **ActiveFilterChips**: fila horizontal de `chip` `accSoft`/`acc` con `X` («Drama ×», «Netflix ×», «2010–2019 ×», «Series ×») + «Limpiar» como texto `acc`. Oculta si no hay filtros.
5. **Línea de resultados**: «128 títulos» (si hay recuento) a la izquierda, orden actual a la derecha («Popularidad ▾», abre el sheet en la sección Ordenar).
6. **Rejilla**: `FlashList` 3 columnas en móvil (4 a ≥ 600 px, 6 a ≥ 1024 px en web), póster + título 1 línea como hoy. Ocupa todo lo que queda (≈ 75 % de la pantalla con chips, ≈ 80 % sin ellos; el resto es cabecera + buscador + nav).
7. **FilterSheet** (`BottomSheet` existente, `snapPoints={[0.85]}`): cabecera «Filtros» + «Restablecer»; secciones Tipo (segmentado Todo/Películas/Series), Plataformas (`PillGroup` multi, wrap), Género (`PillGroup` multi, 6 visibles + «Ver todos»), Época (décadas, single como hoy), Ordenar (Popularidad / Mejor valoradas / Más recientes / A–Z: los `CatalogSort` existentes; **nada de «afinidad»**). Botón fijo `Button` «Ver 128 títulos» (o «Ver resultados» sin recuento). Los cambios se aplican en vivo; al cerrar (botón, gesto o fondo) quedan como chips.

---

## 2. Arquitectura de componentes

### 2.1 Crear

| Archivo | Responsabilidad |
|---|---|
| `src/components/features/home/HeroCarousel.tsx` | Carrusel paginado (FlashList horizontal, `snapToInterval`, `decelerationRate="fast"`), dots, a11y. |
| `src/components/features/home/HeroCard.tsx` | Tarjeta del hero (evoluciona `FeaturedMatchCard`: misma a11y «nota de IA oculta»). |
| `src/components/features/home/Top10Row.tsx` | Fila del ranking, recibe `FeedItem[]` (máx. 10). |
| `src/components/features/home/RankNumber.tsx` | Número SVG con contorno (react-native-svg `Text` con `stroke`), color por tokens. |
| `src/components/features/ReasonLine.tsx` | Icono + razón; reutilizable en hero, filas y ficha. |
| `src/components/features/explore/FilterButton.tsx` | Botón con badge de recuento. |
| `src/components/features/explore/ActiveFilterChips.tsx` | Chips borrables + «Limpiar». |
| `src/components/features/explore/QueryHints.tsx` | Fila de sugerencias «+ Género: X». |
| `src/components/features/explore/FilterSheet.tsx` | Contenido del sheet (secciones + CTA). |
| `src/components/features/explore/ExploreGrid.tsx` | FlashList responsive + footer de carga/error. |
| `src/features/feed/usePersonalizedFeed.ts` | Hook de Inicio (sustituye a `useFeedData`). |
| `src/features/feed/composeFeed.ts` | **Puro**: recs + enriquecidos + gusto → `{ hero, top10, rows }`. |
| `src/features/feed/rowCatalog.ts` | Definición de filas variadas (id, título, consulta) y orden de aparición. |
| `src/recommender/reasons.ts` | **Puro**: `buildReason(...)`, `eraPreference(years)`, `topGenres(taste)`. |
| `src/features/explore/exploreFilters.ts` | **Puro**: tipo `ExploreFilters`, reducer, `activeCount`, `toChips`, `toCatalogParams`. |
| `src/features/explore/parseQueryHints.ts` | **Puro**: detecta género/plataforma/década/año/tipo en el texto. |
| `src/features/explore/useUnifiedSearch.ts` | Hook de datos de Explorar (paginación, reqId, degradación). |
| `supabase/migrations/0025_search_titles.sql` | RPC de búsqueda unificada (§3.4). |

### 2.2 Modificar

| Archivo | Cambio |
|---|---|
| `app/(tabs)/index.tsx` | Reescritura de composición: cabecera + pills + Hero + Top 10 + filas. Pasa de ~230 a ~120 líneas. |
| `app/(tabs)/explore.tsx` | Reescritura: estado a `useExploreFilters`/`useUnifiedSearch`; se eliminan el 2.º buscador y los 3 carriles de chips apilados. |
| `src/store/useFeedStore.ts` | Nuevo estado `{ hero, top10, rows, status, rowCursor }`; `loadFirstPage` usa `composeFeed`; `loadNextRows` sustituye a `loadNextPage`; mantiene la degradación a heurística. |
| `src/types/media.ts` | `FeedItem = MediaWithAffinity & { reason?: Reason }`, `Reason`, `FeedRow` (id string libre, `title`, `subtitle?`, `items`, `seeAll?`). `FeedCategory` queda como alias mientras se migra `see-all`. |
| `src/components/features/PosterCarousel.tsx` | Props `subtitle?`, `showYear?`; sin cambios visuales por defecto (tests actuales verdes). |
| `src/components/ui/SearchBar.tsx` | Prop opcional `accessory?: ReactNode` (derecha) y `accessibilityLabel`. Por defecto igual que hoy. |
| `src/services/supabase/catalog/types.ts` | `BrowseParams.genres?: number[]`, `SearchParams` acepta `genres`, `decade`, `sort`. `genre` se mantiene por compatibilidad. |
| `src/services/supabase/catalog/query.ts` | Operador `ov` (solapamiento de arrays) para `genre_ids`; `buildSearchQuery` aplica tipo/géneros/década/orden. |
| `src/services/supabase/catalog/postgrest.repository.ts` | `search` llama a `rpc('search_titles')` y degrada a la consulta PostgREST actual si el RPC no existe (PGRST202/404). `count(params)` con `head: true, count: 'exact'`. |
| `src/services/supabase/catalog/engine.ts` + `mock.repository.ts` | Mismos filtros en el motor local (tests y modo offline), búsqueda también en `directors`/`cast_top` de los fixtures. |
| `src/services/recommender.ts` | `contentRecommend` acepta `offset` (el RPC ya tiene `p_offset`). Sin cambios de contrato. |
| `app/see-all/[category].tsx` | Acepta ids de fila dinámicos (`genre-18`, `decade-1990`, `liked-movie-496243`, `popular`, `top-rated`, `tv`) vía `rowCatalog`. |
| `src/components/features/FeaturedMatchCard.tsx` (+ test) | Se convierte en `HeroCard` (se mueve y se renombra; el test se adapta, mismas aserciones de a11y). |

### 2.3 Borrar

- `src/features/feed/useFeedData.ts` → reemplazado por `usePersonalizedFeed` (borrar cuando nada lo importe).
- `src/components/features/FeaturedMatchCard.tsx` → movido a `home/HeroCard.tsx`.
- En `explore.tsx`: `creditQuery`, `DECADES` local (pasa a `exploreFilters.ts`), filtrado de géneros en cliente.

---

## 3. Datos

### 3.1 `usePersonalizedFeed()`

```ts
interface PersonalizedFeed {
  hero: FeedItem[];          // 5
  top10: FeedItem[];         // 10, rank implícito por índice
  rows: FeedRow[];           // crecen con loadMoreRows()
  status: 'idle' | 'loading' | 'ready' | 'error';
  platforms: string[];
  setPlatforms(ids: string[]): void;
  reload(): void;
  loadMoreRows(): Promise<void>;
  loadingMore: boolean;
  rowsError: boolean;        // error parcial, no rompe hero/top10
}
```

Mantiene la invalidación actual de `useFeedData` (cambian `initialRatings`, `hasOnboarded`, `entries`, `watched` → `reset()`).

### 3.2 Razones (`src/recommender/reasons.ts`)

Prioridad por ítem (la primera que aplique):

1. `liked`: el RPC trae `explanation[0]` → se usa tal cual («Porque te gustó X»).
2. `genre`: el género del título con más peso en `taste.weightBp` (≥ umbral) → «Porque te gusta el {género en minúscula}». Necesita `genre_ids` del enriquecimiento.
3. `era`: la década del título coincide con `eraPreference` → «Porque buscas cine de los {90}» / «de los 2000». `eraPreference` = década con ≥ 3 títulos valorados ≥ 4 ★ y ≥ 35 % de esos títulos; los años salen de un `byIds` de las entradas del historial (una vez por sesión, cacheado en el store).
4. Sin razón → no se pinta `ReasonLine` (nunca inventar).

Opcional (P10): mover la razón al servidor (`recommend` v2 con `reason_kind`, `genre_ids`, `year`, `backdrop_path`) para ahorrar el enriquecimiento. No bloquea nada.

### 3.3 Composición del feed (`composeFeed`, puro)

Entrada: `recs` (hasta 80 de `contentRecommend`), mapa de enriquecidos, `taste`, `eraPref`, `seenKeys`.

- **Hero (5)**: de los 20 mejores, se eligen 5 maximizando variedad (como mucho 2 con la misma razón y 2 del mismo género principal) y prefiriendo los que tienen backdrop. Si no hay 5 con variedad, se rellena por score.
- **Top 10**: los 10 mejores restantes por score (sin repetir el hero).
- **Filas personalizadas** (con lo que queda de `recs`): agrupar por razón; una fila «Porque te gustó X» por cada X con ≥ 4 títulos (máx. 2 filas), «Porque te gusta el {género}» para los 2 géneros con más peso, «Cine de los {década}» si hay `eraPref`.
- **Filas variadas** (`rowCatalog`, catálogo PostgREST en las plataformas del usuario, excluyendo `seenKeys` y lo ya mostrado): «Joyas ocultas» (la heurística existente), «Populares en tus plataformas» (`sort: popularity`), «Mejor valoradas» (`sort: vote`), «Series para maratonear» (`type: 'tv'`), y una fila de género «Explora: {género que NO está en tu top}» para romper la burbuja.
- Orden en pantalla: alternar personalizada / variada. Las 3 primeras filas llegan con la primera carga; el resto, de 2 en 2 con `loadMoreRows`.
- Deduplicación global por `media_type:id` en todo el feed.

**Degradación**: si `contentRecommend` devuelve `null` (sin sesión, RPC caído, `RECOMMENDER=heuristic`), hero y Top 10 salen de `catalogRepository.getFeedCategories` (heurística actual, que ya ordena por gusto) y las razones solo pueden ser `genre`/`era`.

### 3.4 Búsqueda unificada (`useUnifiedSearch` + RPC `search_titles`)

```ts
interface ExploreFilters {
  query: string;
  type: 'all' | 'movie' | 'tv';
  platforms: string[];
  genres: number[];
  decade: number | null;
  sort: CatalogSort;
}
```

- Sin texto → `browse` (ya en servidor: plataformas, `genres` con `ov`, década, tipo, orden).
- Con texto → `search` → RPC `search_titles(p_query, p_platforms, p_genres, p_decade, p_type, p_sort, p_offset, p_limit)`:
  - coincide si `title_tsv @@ websearch_to_tsquery('spanish', q)` **o** `unaccent(title|original_title) ilike %q%` **o** algún nombre de `directors`/`cast_top` contiene `q` (sin acentos, minúsculas);
  - orden de relevancia: coincidencia exacta de título > título parcial > director > reparto, y después `p_sort`;
  - índice trigram sobre una función `immutable` que concatene `directors || cast_top` (verificar que `unaccent`/`pg_trgm` de 0006 están en el esquema `extensions`);
  - `security invoker`, `grant execute` a `anon` y `authenticated`; prueba en `scripts/` como los `sql-*-local.mjs`.
- Degradación: si el RPC no existe, `search` usa la consulta PostgREST actual con los filtros nuevos (pierde director/actor, nada más).
- `count`: consulta `head` con los mismos filtros, debounced 300 ms, solo cuando el sheet está abierto o cambian los filtros. Si falla, el CTA dice «Ver resultados».
- Debounce de texto: 300 ms (`useDebounce` existente). `reqId` para descartar respuestas viejas (patrón actual).

---

## 4. Responsive y accesibilidad

**Responsive**
- Base 375 px. Hero: ancho `width - 40`, alto `min(440, width * 1.15)`; a ≥ 768 px (web) el hero pasa a 2 tarjetas visibles (ancho 520) y las filas muestran más pósters sin cambiar tamaño.
- Rejilla de Explorar: columnas = `width < 600 ? 3 : width < 1024 ? 4 : 6` (`useWindowDimensions`).
- FilterSheet: en web ≥ 768 px, ancho máximo 560 centrado (mismo `BottomSheet`).
- Todo con `paddingBottom: BOTTOM_NAV_HEIGHT + 24` como hoy.
- Dark/light: solo tokens; el degradado del hero usa `alpha(colors.card, …)` de `src/theme/alpha.ts`. Revisar contraste con `node scripts/contraste.mjs` (texto sobre degradado ≥ 4.5:1).

**Accesibilidad**
- HeroCard: `accessibilityLabel` «Para ti, 1 de 5: Aftersun. Match alto, nota de IA oculta. Porque te gustó Past Lives» (mantener la fórmula de `FeaturedMatchCard`). Acciones a11y «siguiente/anterior» en el carrusel. Sin autoplay.
- Top 10: cada ítem «Número 3 de tu Top 10: Perfect Days»; el número SVG es `accessible={false}`.
- Filas: cabecera `accessibilityRole="header"`; subtítulo leído con la cabecera.
- FilterButton: «Filtros, 3 activos»; chips: «Quitar filtro Drama»; «Limpiar todos los filtros».
- QueryHints: «Añadir filtro género Thriller».
- Sheet: foco al título al abrir, vuelve al botón al cerrar; `PillGroup` con `accessibilityState.selected` (ya lo hace).
- Áreas táctiles ≥ 44×44 (chips de 32 px de alto con `hitSlop`).
- `useMotionPreference`: sin animación del carrusel ni del sheet si hay movimiento reducido (el `BottomSheet` ya lo respeta).
- **Regla de privacidad de nota**: ningún texto numérico de nota en Inicio/Explorar (test dedicado, §6).

---

## 5. Tareas ordenadas

Complejidad: **S** (< 1 h), **M** (1–3 h), **L** (media sesión o más). Cada P se puede cerrar en una sesión y deja la app funcionando.

### Bloque Explorar (primero: menos riesgo y arregla bugs reales)

- [ ] **P1 · Filtros puros de Explorar** — M
  - Crear `src/features/explore/exploreFilters.ts` (tipo, reducer `toggleGenre/togglePlatform/setDecade/setType/setSort/clear/removeChip`, `activeCount`, `toChips`, `toCatalogParams`).
  - Crear `src/features/explore/parseQueryHints.ts` (usa `GENRES`, `PLATFORMS`, alias: «sci-fi», «ciencia ficcion» sin tilde, «años 90», «90s», «1994», «serie/series», «peli/película»).
  - Tests: `exploreFilters.test.ts`, `parseQueryHints.test.ts`.

- [ ] **P2 · Catálogo: géneros múltiples y filtros en búsqueda** — M
  - `types.ts`: `genres?: number[]`; `SearchParams` con `genres`, `decade`, `sort`.
  - `query.ts`: op `ov`; `buildSearchQuery` con tipo/géneros/década/orden.
  - `engine.ts`/`mock.repository.ts`: mismos filtros + búsqueda en `directors`/`cast_top` de fixtures.
  - `postgrest.repository.ts`: `count(params)`.
  - Tests: ampliar `catalog.postgrest.test.ts` y `catalog.paginated.test.ts` (`genre_ids=ov.{18,53}`, búsqueda con década).

- [ ] **P3 · RPC `search_titles` (migración 0025)** — L
  - `supabase/migrations/0025_search_titles.sql` + índice trigram de créditos.
  - `scripts/sql-search-local.mjs` + `scripts/sql-search-test.sql` (siguiendo `sql-recommend-local.mjs`): «villeneuve» → títulos dirigidos; «Dune» → título primero; filtros combinados.
  - `postgrest.repository.ts`: `search` → RPC con degradación (test con cliente mock que devuelve PGRST202).
  - Avisar al dueño antes de aplicar la migración en Supabase.

- [ ] **P4 · Hook `useUnifiedSearch`** — M
  - Sale de `explore.tsx` toda la lógica de páginas/reqId/estado. Expone `{ items, status, hasMore, loadMore, reload, total }`.
  - Tests: `useUnifiedSearch.test.ts` (debounce, descarta respuestas viejas, cambia entre browse/search, recuento con fallo).

- [ ] **P5 · UI de Explorar** — L
  - `SearchBar` + `accessory`; `FilterButton`, `ActiveFilterChips`, `QueryHints`, `FilterSheet`, `ExploreGrid`.
  - Reescribir `app/(tabs)/explore.tsx`.
  - Tests: `FilterButton.test.tsx` (badge y label), `ActiveFilterChips.test.tsx` (quitar chip, limpiar), `FilterSheet.test.tsx` (toggle aplica en vivo, CTA con recuento, «Restablecer»), `SearchBar.test.tsx` (accesorio sin romper lo actual), `app/explore.screen.test.tsx` (un solo `search`, sin carriles apilados, rejilla visible con filtros activos).
  - Capturas con `scripts/capturas-tabs3.mjs` en claro y oscuro.

### Bloque Inicio

- [ ] **P6 · Razones y composición pura** — L
  - `src/recommender/reasons.ts` + `src/features/feed/composeFeed.ts` + `rowCatalog.ts`.
  - Tipos `FeedItem`, `Reason`, `FeedRow` en `src/types/media.ts`.
  - Tests: `reasons.test.ts` (prioridad liked > genre > era, sin razón no inventa, umbral de época), `composeFeed.test.ts` (5 hero variados, Top 10 sin repetidos, deduplicación global, alternancia de filas, degradación sin recs).

- [ ] **P7 · Store y hook del feed** — L
  - `useFeedStore`: nuevo estado, `loadFirstPage` con `contentRecommend({limit: 80})` + `byIds` por tipo + `composeFeed`; `loadNextRows`; cache de `eraPreference`.
  - `usePersonalizedFeed.ts`; mantener invalidaciones de `useFeedData`.
  - Tests: adaptar `useFeedStore.test.ts` y `feedMood.test.ts` (el destacado sigue sin repetirse; ahora en hero/Top 10), nuevo caso de error parcial de fila.

- [ ] **P8 · Componentes de Inicio** — L
  - `ReasonLine`, `HeroCard` (desde `FeaturedMatchCard`), `HeroCarousel`, `RankNumber`, `Top10Row`; `PosterCarousel` con `subtitle`/`showYear`.
  - Tests: `HeroCard.test.tsx` (adaptado de `FeaturedMatchCard.test.tsx`), `HeroCarousel.test.tsx` (5 páginas, label «1 de 5»), `Top10Row.test.tsx` (10 ítems, labels «Número N»), `ReasonLine.test.tsx`, `PosterCarousel` con subtítulo.

- [ ] **P9 · Pantalla Inicio + see-all** — M
  - Reescribir `app/(tabs)/index.tsx`; skeleton nuevo; borrar `useFeedData.ts`.
  - `app/see-all/[category].tsx` con ids de `rowCatalog`.
  - Tests: `app/home.screen.test.tsx` (orden hero → Top 10 → filas; estados vacío/error), **`noAiScore.test.tsx`**: renderiza Inicio y Explorar con datos de fixture y comprueba que no hay texto `/\b[1-5],\d\b/`, `/\d+ ?%/` ni «nota estimada».
  - Capturas claro/oscuro y `node scripts/contraste.mjs`.

### Mejoras posteriores (opcionales)

- [ ] **P10 · `recommend` v2** — L: devolver `reason_kind`, `genre_ids`, `year`, `backdrop_path` desde el RPC y quitar el `byIds` del primer render. Medir antes con `scripts/eval-recomendador.mjs`.
- [ ] **P11 · Paginación real del feed de contenido** — M: usar `p_offset` para más filas personalizadas cuando se agoten los 80.
- [ ] **P12 · E2E** — M: `e2e/explore.spec.ts` (buscar, abrir filtros, chip, quitar chip) y `e2e/home.spec.ts` (hero, Top 10, scroll carga filas) con `supabaseMock.ts`.

### Resumen

| P | Tarea | Archivos principales | Compl. |
|---|---|---|---|
| P1 | Filtros puros | `features/explore/exploreFilters.ts`, `parseQueryHints.ts` | M |
| P2 | Catálogo multi-filtro | `catalog/types.ts`, `query.ts`, `engine.ts`, `postgrest.repository.ts` | M |
| P3 | RPC `search_titles` | `migrations/0025_search_titles.sql`, `scripts/sql-search-*` | L |
| P4 | `useUnifiedSearch` | `features/explore/useUnifiedSearch.ts` | M |
| P5 | UI Explorar | `app/(tabs)/explore.tsx`, `components/features/explore/*`, `SearchBar.tsx` | L |
| P6 | Razones + composición | `recommender/reasons.ts`, `features/feed/composeFeed.ts`, `rowCatalog.ts`, `types/media.ts` | L |
| P7 | Store + hook feed | `store/useFeedStore.ts`, `features/feed/usePersonalizedFeed.ts` | L |
| P8 | Componentes Inicio | `components/features/home/*`, `ReasonLine.tsx`, `PosterCarousel.tsx` | L |
| P9 | Pantalla Inicio + see-all | `app/(tabs)/index.tsx`, `app/see-all/[category].tsx` | M |
| P10–P12 | Opcionales | RPC v2, paginación, e2e | L/M/M |

Reparto sugerido por sesiones: **S1** P1+P2 · **S2** P3+P4 · **S3** P5 · **S4** P6 · **S5** P7+P8 · **S6** P9 (+P12).

---

## 6. Tests: resumen

**Nuevos**: `exploreFilters`, `parseQueryHints`, `useUnifiedSearch`, `FilterButton`, `ActiveFilterChips`, `FilterSheet`, `explore.screen`, `reasons`, `composeFeed`, `HeroCarousel`, `Top10Row`, `ReasonLine`, `home.screen`, `noAiScore`, SQL `sql-search-test.sql`.

**A modificar** (deben seguir verdes con los cambios):
- `src/store/useFeedStore.test.ts`, `src/store/feedMood.test.ts`: nuevo shape del store.
- `src/components/features/FeaturedMatchCard.test.tsx` → `HeroCard.test.tsx`.
- `src/services/supabase/catalog/catalog.postgrest.test.ts`, `catalog.paginated.test.ts`: filtros nuevos.
- `src/components/ui/SearchBar` (si tiene test, añadir caso de accesorio).

**Sin tocar** (comprobar que siguen verdes): `tabsLayout.test.ts`, `bottomNavVisibility.test.ts`, `BottomSheet.test.tsx`, `PillGroup.test.tsx`, `recommender.test.ts`, `wireframeFacts.test.tsx`.

Batería tras cada P: `npm run verify` y `node scripts/auditoria-estilos.mjs`.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El enriquecimiento `byIds` añade latencia al primer render. | Pintar hero/Top 10 con lo que trae el RPC (póster + título) y completar meta/razón al llegar; P10 lo elimina. |
| `search_titles` lento con `ilike` sobre créditos. | Índice trigram; límite 20 por página; medir con un script como `sql-recommend-scale.mjs`. |
| Pocas recomendaciones (usuario nuevo, pocas plataformas). | `composeFeed` rellena con filas variadas; hero mínimo 1, Top 10 se oculta si hay < 5. |
| Razón «época» poco fiable con poco historial. | Umbral (≥ 3 títulos y ≥ 35 %); si no se cumple, no se usa. |
| Fuga de la nota IA en un componente nuevo. | `noAiScore.test.tsx` y revisión en cada PR. |
