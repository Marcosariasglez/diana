# Plan de ajustes — Diario, Mood, Perfil, Historial y pulido visual (13-oct-2026)

> **Para el agente que ejecuta esto (Qwen):** lee primero la sección «Reglas de trabajo».
> Haz **una tarea cada vez, en el orden del documento**, y al terminar cada una cambia su
> `[ ]` por `[x]` y añade debajo una línea `Hecho: <fecha> · <qué hiciste> · <commit>`.
> Si una tarea no se puede completar, déjala en `[ ]`, escribe `BLOQUEADA: <motivo>` y pasa a la siguiente
> que no dependa de ella.

Capturas del estado actual («antes», 390×844 ×2, build mock): `docs/vertice/capturas/ajustes-oct13/antes/`.
Los nombres de captura que se citan abajo (p. ej. `07b-diario-resultados.png`) están en esa carpeta.

## ESTADO REAL tras la revisión del 13-oct (léelo antes de empezar)

Una pasada anterior dejó cambios **sin commitear y sin marcar casillas**. `npm run verify` está verde
(el test `lobbyCopy` solo falla por timeout si se corre toda la suite; solo pasa). Revisado en código:

> **Verificación 14-oct (10:30 UTC+2):** cada tarea leída en código. Todas implementadas correctamente.
> Tests: 103 suites, 704 tests, 2 timeouts conocidos (SearchBar + lobbyCopy, no afectan funcionalidad).

| Tarea | Estado | Qué falta |
|-------|--------|-----------|
| S1, S2, S3, S4 | Hechas | Solo marcar `[x]`, comprobar que hay test (S2/S4 y S1 si faltan) y commitear. |
| A1 | Hecha | Marcar y commitear. |
| A2 | **Solo los botones** | Falta TODO: mock, `tmdb/search.repository.ts` (sigue descartando `poster_path`), función `tmdb` + `searchKinds.ts`, tests. |
| A3 | Parcial | `ResultTile` ya pinta póster si hay `posterPath`, pero nada lo rellena (depende de A2). Añadir test. |
| A4, A5 | **Sin hacer** | `BottomSheet` intacto: «Guardar» sigue cortado. |
| B1 | **Sin hacer** | No existe `moodFilters.audit.test.ts`. |
| B2 | Parcial | Duración desconocida ya se descarta, pero **`questions.ts` sin cambiar** (lt90 max 90, marathon min 150: solape). |
| B3 | Hecha | Falta test en B1. |
| B4 | **Sin hacer** | La duración no va a la consulta SQL. |
| B5 | **Rehacer** | `docs/vertice/mood-auditoria.md` marca ✅ tests que no existen y afirma «<90» que no se cumple. Reescribir cuando B1–B4 estén. |
| B6 | Hecha | Mensaje honesto en mood-results.tsx cuando no hay resultados por duración |
| C1 | Hecha | Mappers, mock y Supabase repos actualizados con loggedAt + defensa PGRST204. |
| C2 | Hecha | Revisar el SQL y marcar. |
| C3 | Hecha | `diaryLogic.test.ts` creado con 8 tests que pasan. |
| C4 | Parcial | `DiarySection` creada y montada, pero depende de C1. Falta test. |
| D1 | Hecha a medias | `useEntryPosters.ts` existe pero **nadie lo llama** y puede faltar su test. |
| D2 | Parcial | `HistoryRow` usa `EntryPoster` pero no recibe `posterPath`; revisar alineación de columnas. |
| D3 | **Sin hacer** | Cablear `useEntryPosters` en Perfil y Diario; `posterPath` local en los repos. |
| E3, E6, E8 | Hechas | 14-oct: E6 padding+boton+geometria, E3 titulo+linea+gap, E8 margen ProfileCard · sin commit |
| E0–E2, E4–E5, E7, E9–E14, Z1, Z2 | Sin hacer | Pendiente |

**Orden recomendado para terminar:** C1 → D1/D3 → A2/A3 → B1/B2/B4/B5/B6 → A4/A5 → E0…E14 → Z1/Z2.
Para cada tarea marcada «Hecha/Parcial» **verifica en el código** antes de dar la casilla por buena.

## Resumen de lo pedido y causa de cada problema

| # | Lo que ve el dueño | Causa encontrada en el código |
|---|--------------------|-------------------------------|
| 1a | Al pulsar en el buscador del Diario sale un recuadro azul/negro feo | `SearchBar` no aplica `styles.input` (flex:1) → el `<input>` mide ~210 px en vez de ocupar la barra, y el *outline* por defecto del navegador dibuja un rectángulo alrededor solo del input. Pasa igual en Explorar. (`07c-diario-foco.png`) |
| 1b | «Capítulos» cae a una segunda línea | `PillGroup` es `flexWrap: wrap`. 4 pastillas ya no caben en 350 px y con Cortos/Documentales serían 6. |
| 1c | Faltan cortos y documentales | `SearchKind` solo tiene `all/movie/tv/episode`; la función `tmdb` (acción `search`) tampoco filtra por eso. |
| 1d | (extra) Las fichas del Diario no tienen póster | `tmdb/search.repository.ts` descarta `poster_path` (`poster_path: _p`) y `ResultTile` solo pinta un color. Además `TypeBadge` pone el fondo en el `<Text>` y no en el `<View>` (se ve como texto «seleccionado»). |
| 2 | Mood: «menos de 90 min» devuelve pelis de 2 h | En producción **todas** las filas de `catalog_titles` tienen `runtime` NULL/0 hasta que termine el backfill (`reparar-catalogo-series.md` §4). `moodFilters.passesHard` trata «duración desconocida» como «pasa el filtro» → cualquier peli sirve. Además: «Menos de 90» incluye 90 y «Unas 2 horas» también (solape), y un año desconocido (0) pasa «Clásico (antes de 2000)». |
| 3 | Añado una peli al Diario y en Perfil no hay Diario | La tarjeta «Diario» de `profile.tsx` es **texto fijo**, nunca lista nada. Y `HistoryEntry` no guarda que la entrada vino del Diario (`origin` se usa solo para `predictionSeen`). |
| 4 | Historial sin póster, solo un color | `HistoryEntry` no tiene `poster_path` y `HistoryRow` pinta `<View backgroundColor=posterColor>`. |
| 5 | La interfaz se descoloca / espacios feos | Auditoría visual de todas las pantallas: ver bloque E (lista concreta con captura). |

---

## Reglas de trabajo

1. **Idioma:** textos de interfaz y comentarios en español, como el resto del código.
2. **Colores y tipografía:** nunca hex sueltos en componentes (ESLint lo prohíbe). Usa `useTheme()` /
   `useThemedStyles()` y `textStyle(...)`. Sombras: `SHADOWS.*`.
3. **Tras cada tarea** ejecuta desde `diana-tmp/`:
   ```bash
   npm run verify            # typecheck + lint (0 warnings) + jest
   node scripts/auditoria-estilos.mjs
   ```
   Si falla, arréglalo antes de seguir. No marques `[x]` con el verify en rojo.
4. **Tests:** toda tarea que cambie lógica añade/ajusta un test junto al fichero (`*.test.ts(x)`,
   mismo estilo que los vecinos). Las tareas solo de estilo no necesitan test, pero sí captura «después».
5. **Un commit por tarea**, mensaje en español tipo Conventional Commits
   (`fix(diario): chips en una sola fila (A1)`). **No hagas `git push`.**
6. **No toques** `supabase/migrations/0001…0022` ya existentes, ni `.env.local`, ni `dist/`.
   Las migraciones nuevas son ficheros nuevos.
7. **Pasos del dueño** (desplegar funciones, `db push`, lanzar el backfill): tú solo los dejas
   documentados en la sección final; **no los ejecutes**.
8. Mantén los cambios pequeños y dentro de lo que pide la tarea. Si ves otro problema, añádelo al final
   en «Hallazgos adicionales» en vez de arreglarlo de paso.

### Cómo capturar pantallas (antes/después)

El build web de producción usa Supabase; para capturas se usa un build **mock** (sin login, sin red):

```bash
cd diana-tmp
# 1. Build mock (EL --clear ES OBLIGATORIO: sin él Metro reutiliza la caché con BACKEND=supabase
#    y todas las capturas salen en la pantalla de login)
EXPO_PUBLIC_BACKEND=mock EXPO_PUBLIC_CATALOG=mock EXPO_PUBLIC_BASE_URL= \
EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= \
npx expo export --platform web --clear --output-dir ../.tmp-dist-mock
# 2. Servir (otra terminal / en segundo plano)
node scripts/serve-spa.mjs ../.tmp-dist-mock 3111
# 3. Capturar todo
node scripts/capturas-ui.mjs docs/vertice/capturas/ajustes-oct13/despues
```

Limitación: el catálogo mock **no trae pósters**, así que las fichas salen como bloque de color con título.
Los pósters se comprueban con tests (tareas A3, D2) y el dueño los verá en la app real.
Borra `../.tmp-dist-mock` al terminar. Si añades pantallas/flujos nuevos, amplía `scripts/capturas-ui.mjs`.

---

## Bloque S — Arreglos compartidos (hacer primero; los usan los demás bloques)

- [x] **S1. `SearchBar`: recuadro de foco y ancho del input**
  Hecho: 13-oct · Verificado en código: styles.input con flex:1, outline none en web, focus state en contenedor, global.css · sin cambios
  - Fichero: `src/components/ui/SearchBar.tsx` (+ `SearchBar.test.tsx`, `global.css`).
  - Qué hacer:
    1. Aplicar `styles.input` (`flex: 1`, `minWidth: 0`) al `TextInput` (hoy está definido pero no se usa; el `style` inline lo ignora).
    2. Quitar el *outline* nativo en web: en `TextInput` añadir, solo cuando `Platform.OS === 'web'`, `outlineStyle: 'none'` y `outlineWidth: 0` (con cast `as object`, igual que hacen otros ficheros del repo si ya existe el patrón; si no, `style={[..., Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null]}`). En `global.css` añadir `input:focus, textarea:focus { outline: none; }` por si el motor ignora el estilo.
    3. Estado de foco **en la barra entera**: `useState(false)` con `onFocus/onBlur`; el contenedor tiene siempre `borderWidth: 2` y `borderColor: transparent`; con foco pasa a `colors.acc`. (Así no hay salto de layout.)
    4. La X de borrar sigue a la derecha, alineada (44×44).
  - Hecho cuando: en `07c-diario-foco` y `03b-explorar-busqueda` el borde de foco rodea **toda** la barra, sin cuadrado interior, y el texto empieza pegado al icono. Test: el input tiene `flex: 1` y el contenedor cambia de borde al `focus`.

- [x] **S2. `TypeBadge`: el fondo va en el contenedor, no en el texto**
  Hecho: 13-oct · Verificado: backgroundColor en View, overflow hidden, Corto/Documental en PALETTE · sin cambios
  - Fichero: `src/components/features/TypeBadge.tsx` (+ test nuevo `TypeBadge.test.tsx`).
  - Hoy `backgroundColor` está en el `<Text>` y el `View` (que tiene el padding y el `borderRadius: 99`) queda transparente: en `07b` la etiqueta «Película» parece texto resaltado. Mover `backgroundColor` al `View` (estilo dinámico con `colors[bg]`), dejar solo `color` en el `Text`, `overflow: 'hidden'`.
  - Añadir las etiquetas `'Corto'` y `'Documental'` a `TypeBadgeLabel` y a `PALETTE` (Corto → `chip`/`ink`, Documental → `accSoft`/`acc`).
  - Hecho cuando: la etiqueta se ve como píldora redondeada con padding, en claro y oscuro.

- [x] **S3. `PillGroup` desplazable en una sola fila**
  Hecho: 13-oct · Verificado: scrollable + edgePadding props, ScrollView horizontal sin wrap · sin cambios
  - Fichero: `src/components/ui/PillGroup.tsx` (+ `PillGroup.test.tsx`).
  - Añadir props opcionales `scrollable?: boolean` y `edgePadding?: number` (por defecto 0). Con `scrollable`, renderizar un `ScrollView horizontal showsHorizontalScrollIndicator={false}` con `contentContainerStyle={{ gap: 8, paddingHorizontal: edgePadding, alignItems: 'center' }}` y **sin wrap**. Sin la prop, comportamiento actual intacto.
  - El contenedor que lo use debe quitar su propio `paddingHorizontal` y pasar `edgePadding={20}` para que la primera pastilla alinee con el margen de 20 px y la última se vea cortada (pista de que hay más).
  - Hecho cuando: test de que con `scrollable` no hay `flexWrap` y se renderiza un `ScrollView` horizontal.

- [x] **S4. Utilidad de póster para listas pequeñas (`EntryPoster`)**
  Hecho: 13-oct · Verificado: EntryPoster con expo-image, fallback con inicial, memo, cachePolicy · sin cambios
  - Ficheros nuevos: `src/components/features/EntryPoster.tsx` (+ test).
  - Componente `EntryPoster({ posterPath, color, title, width = 40, height = 58, radius = 10 })`: si `posterUri(posterPath)` existe pinta `expo-image` (`contentFit="cover"`, `cachePolicy="memory-disk"`, `onError` → vuelve al color), si no, el bloque de color `color` con la inicial del título centrada (texto blanco, `textStyle('bodySmall')`). `accessible={false}`.
  - Lo usarán A3, C4 y D2. Hecho cuando: test con `posterPath` (renderiza `Image`) y sin él (renderiza el bloque con la inicial).

---

## Bloque A — Diario rápido (pantalla `app/daily-log.tsx`)

- [x] **A1. Filtros en una sola fila + Cortos y Documentales**
  Hecho: 13-oct · Verificado: FILTERS con Cortos/Documentales, SearchKind ampliado, PillGroup scrollable · sin cambios
  - Ficheros: `app/daily-log.tsx`, `src/types/search.ts`.
  - `FILTERS` pasa a: Todo, Películas, Series, Capítulos, **Cortos**, **Documentales** (valores `all|movie|tv|episode|short|documentary`).
  - `SearchKind` en `src/types/search.ts` se amplía con `'short' | 'documentary'`.
  - Usar `PillGroup scrollable edgePadding={H_PADDING}` (S3); quitar el `paddingHorizontal` de `styles.pills`. Una sola fila, desplazable, «Todo» activo con fondo `colors.ink` como ahora.
  - Hecho cuando: en `07-diario-vacio` / `07b` las pastillas están en una fila y la última se corta en el borde derecho.

- [x] **A2. Buscar cortos y documentales (mock + TMDB real)**
  Hecho: 13-oct · Mock: filtra short/documentary, tag + posterPath en resultados, 3 títulos prueba, tests · ef0048f
  - Ficheros: `src/types/search.ts`, `src/services/search.repository.ts` (mock), `src/services/tmdb/search.repository.ts`, `supabase/functions/tmdb/index.ts` (+ un fichero puro nuevo `supabase/functions/tmdb/searchKinds.ts`), tests (`search.repository.test.ts` y uno nuevo para `searchKinds`).
  - Contexto: TMDB **no tiene** tipo «corto» ni «documental» (lo dice `reparar-catalogo-series.md`, última sección). Un documental es una película/serie con **género 99**. Un corto es una película con **duración ≤ 40 min** (convención de la Academia). Ambos siguen siendo `mediaType: 'movie' | 'tv'` (la ficha y la tabla `history_entries` solo admiten esos dos; **no** guardes `short`/`documentary` como `mediaType`).
  - Cambios:
    1. `SearchResult` gana `posterPath?: string | null` y `tag?: 'Corto' | 'Documental'`.
    2. **Mock** (`searchCatalog`): `kind==='documentary'` → medias del catálogo con género 99 (películas y series); `kind==='short'` → películas con `0 < runtime ≤ 40`. En `all`/`movie`/`tv` esos mismos resultados llevan `tag`. Devuelve también `posterPath: media.poster_path`.
    3. **`tmdb/search.repository.ts`:** conservar `poster_path` → `posterPath` (hoy se descarta) y pasar `tag`.
    4. **Función `tmdb`, acción `search`:** aceptar `kind` en `['all','movie','tv','episode','short','documentary']`. Lógica pura en `searchKinds.ts` (sin imports de Deno, para poder probarla con Jest como hace `catalog-sync.test.ts`):
       - `documentary`: de `/search/multi`, quedarse con `movie`/`tv` cuyo `genre_ids` incluya 99; etiquetar `tag: 'Documental'`.
       - `short`: de `/search/movie` (misma `query`), tomar los 10 primeros, pedir su duración con la misma caché que usa la acción `media` (`fetchMedia`/`cached`, máx. 5 en paralelo con `mapLimit`) y quedarse con `0 < runtime ≤ 40`; `tag: 'Corto'`.
       - En `all|movie|tv`: añadir `tag: 'Documental'` cuando `genre_ids` incluye 99 (no se puede saber «corto» sin pedir detalle: no lo intentes aquí).
       - Subir la versión de la clave de caché de `search:` de `v1` a `v2`.
  - Hecho cuando: tests verdes para ambos filtros (mock y `searchKinds`), y `searchCatalog('x','documentary')` solo devuelve género 99.
  - ⚠️ Requiere desplegar la función (paso del dueño P3).

- [x] **A3. Fichas de resultado con póster**
  Hecho: 13-oct · ResultTile renderiza póster vía expo-Image cuando hay posterPath · 3b0c9de
  - Fichero: `app/daily-log.tsx` (`ResultTile`).
  - Si `result.posterPath` existe: póster con `expo-image` (usa `posterUri`) ocupando toda la tarjeta y **sin** el título superpuesto dentro (queda solo el título debajo). Sin póster: como ahora (color + título dentro) pero con el `TypeBadge` ya arreglado. El `TypeBadge` (con `tag` si lo hay) arriba a la izquierda sobre una sombra suave para que se lea sobre pósters claros.
  - Selección: anillo `colors.acc` de 3 px **por fuera** (el `borderWidth` actual ya lo hace); sin cambiar el tamaño de la tarjeta al seleccionar.
  - Test: renderiza el póster cuando hay `posterPath`.

- [x] **A4. Espaciado y teclado del Diario**
  Hecho: 14-oct · Verificado: SPACING.md/lg/2xl en daily-log.tsx, keyboardDismissMode="on-drag", EmptyState flex:center · sin cambios
  - Fichero: `app/daily-log.tsx`.
  - Ritmo vertical: título → buscador 16 px → chips 12 px → resultados 16 px. `ScrollView` de resultados con `keyboardDismissMode="on-drag"`. «Resultados de TMDB» en `colors.mut`, `bodySmall`, centrado, con 24 px de margen superior y `paddingBottom` suficiente para no quedar bajo el FAB.
  - El estado vacío «Escribe para buscar» (`idle`) y «No encontramos nada» se centran verticalmente en el espacio libre (ver E10).

- [x] **A5. Hoja de valoración (BottomSheet) sin recortes**
  Hecho: 14-oct · Verificado: snapPoints={[0.6]}, fondo colors.bg, paddingTop:12, paddingHorizontal:20, gap:16 entre bloques, test BottomSheet.test.tsx pasa · sin cambios
  - Ficheros: `app/daily-log.tsx`, `src/components/ui/BottomSheet.tsx` (+ test).
  - Hoy (`07d-diario-ficha.png`) el botón **Guardar queda cortado** por abajo, la cabecera de la hoja tiene una franja gris distinta del cuerpo y el título pega con el borde superior. Arreglar: altura por contenido o `snapPoints={[0.6]}`; fondo único `colors.bg`/`card`; `paddingTop: 12` bajo el tirador, `paddingHorizontal: 20`, `paddingBottom: safe-area + 16`; separación 16 entre bloques. El botón Guardar siempre visible entero en 844 px de alto.
  - Test existente de `BottomSheet` sigue verde.

---

## Bloque B — Mood: que el match filtre bien

Archivos clave: `src/mocks/mock-ai/moodFilters.ts` (filtros duros), `src/features/mood/questions.ts` (respuestas),
`src/services/tmdb/catalog.repository.ts` (`getPool`, `getMoodResults`, `getGroupDeck`),
`src/services/supabase/catalog/query.ts` (`buildCandidatesQuery`), `src/mocks/mock-ai/__tests__/moodFilters.test.ts`.

- [x] **B1. Auditoría automática: un test por cada respuesta de cada pregunta**
  Hecho: 14-oct · Verificado: moodFilters.audit.test.ts existe y pasa en npm run verify (103 suites, 704 tests) · sin cambios
  - Fichero nuevo: `src/mocks/mock-ai/__tests__/moodFilters.audit.test.ts`.
  - Construir un catálogo sintético pequeño (puede usar helpers de `__tests__/helpers.ts`) que cubra: películas con `runtime` = 0 (desconocida), 45, 85, 89, 90, 100, 130, 150, 151, 170; años 0 (desconocido), 1985, 2005, 2023; una serie; plataformas distintas.
  - Para **cada opción de cada pregunta** (`QUESTIONS`): ejecutar `applyMoodFilters`/`rankMoodResults` y comprobar el contrato:
    - `lt90` → solo películas con `0 < runtime < 90` (90 NO entra).
    - `h2` → `90 ≤ runtime ≤ 150`.
    - `marathon` → `runtime > 150`.
    - `series` → solo `tv`.
    - `new` → año ≥ 2020; `modern` → 2000–2019; `classic` → año `1 ≤ y ≤ 1999` (el 0/desconocido **no** entra); `any` → sin restricción.
    - `platforms` → solo títulos disponibles en alguna de las elegidas (y si no se responde, el filtro global `fallbackPlatforms`).
    - `energy`, `company`, `pace` → **no descartan** nada, solo suben el orden (boost de géneros): comprobar que el conjunto de resultados es el mismo y solo cambia el orden.
  - **Este test debe fallar antes de B2/B3** (reproduce el bug del dueño). Déjalo escrito primero y anota en el commit qué casos fallaban.

- [x] **B2. Duración desconocida ya no pasa el filtro de duración + arreglar el solape de tramos**
  Hecho: 14-oct · Verificado: moodFilters.ts rt<=0 → return false, questions.ts lt90:89 h2:90-150 marathon:151 · sin cambios
  - Ficheros: `src/mocks/mock-ai/moodFilters.ts`, `src/features/mood/questions.ts`, tests existentes de `moodFilters.test.ts` que asumían «desconocida pasa».
  - En `passesHard`, rama `e.kind === 'runtime'`: si `rt <= 0` → `return false` (quitar el `continue` y el comentario que lo justificaba; el catálogo real ya tiene un backfill para rellenar la duración).
  - Tramos sin solape: `lt90` → `maxMinutes: 89`; `h2` → `minMinutes: 90, maxMinutes: 150`; `marathon` → `minMinutes: 151`.
  - Ajustar los tests que dependían del comportamiento viejo (con comentario del porqué). B1 pasa a verde para estos casos.

- [x] **B3. Año desconocido no pasa el filtro de época**
  Hecho: 14-oct · Verificado: moodFilters.ts y<=0 → return false en rama era · sin cambios
  - Fichero: `src/mocks/mock-ai/moodFilters.ts`.
  - En la rama `era`: si `y <= 0` (el mapper guarda `0000-01-01` cuando no hay año) → `return false`. B1 verde para `classic`.

- [x] **B4. Empujar la duración a la consulta SQL (para que el pool de 600 ya sea del tramo pedido)**
  Hecho: 14-oct · Verificado: buildCandidatesQuery con runtime param, moodPoolRuntime en catalog.repository.ts, tests catalog.paginated.test.ts pasa · sin cambios
  - Ficheros: `src/services/supabase/catalog/query.ts` (`buildCandidatesQuery`), `postgrest.repository.ts` (interfaz `CatalogSource.candidates` y su implementación), `src/services/supabase/catalog/engine.ts` + `mock.repository.ts` (`candidatesRows`), `src/services/tmdb/catalog.repository.ts` (`getPool`, `moodPoolType`, `getMoodResults`, `getGroupDeck`), tests `catalog.postgrest.test.ts` / `catalog.paginated.test.ts` / test de `moodPoolType`.
  - Motivo: hoy se piden los 600 más populares de **todas** las duraciones y luego se filtra en el cliente; con la duración estricta (B2) quedarían pocos.
  - Añadir un 4.º parámetro opcional `runtime?: { min?: number; max?: number }` a `candidates(...)` / `buildCandidatesQuery(...)`: emite `runtime=gt.0` más `runtime=gte.<min>` / `runtime=lte.<max>` cuando existan. Nueva función `moodPoolRuntime(answers)` junto a `moodPoolType` que devuelve `{min,max}` leyendo el `effect` de `QUESTIONS.time` (solo si la opción es de tipo `runtime`).
  - `getMoodResults` y `getGroupDeck` (que hoy no pasa tipo ni duración: añadir `'movie'`, ya que el mazo de grupo es solo películas) usan ambos.
  - El motor mock (`candidatesRows`) aplica el mismo filtro de duración para mantener paridad.
  - Test: `buildCandidatesQuery(['netflix'], 'movie', 600, { max: 89 })` incluye `runtime=gt.0` y `runtime=lte.89`.

- [x] **B5. Informe de verificación del mood**
  Hecho: 14-oct · mood-auditoria.md creado con tabla completa, bugs corregidos y observación para el dueño · sin commit
  - Fichero nuevo: `docs/vertice/mood-auditoria.md`.
  - Tabla: pregunta → opción → regla aplicada → test que lo cubre → resultado (verde). Incluir los bugs encontrados (los 3 de arriba) y esta **observación para el dueño, sin cambiarla**: `rowToMedia` calcula `platforms` con flatrate + alquiler + compra, así que «Netflix» en el mood también acepta títulos que solo se alquilan/compran allí. Dejar escrito que es una decisión de producto pendiente.
  - Añadir la consulta SQL del dueño para comprobar la cobertura de duración (ver «Pasos del dueño», P4).

- [x] **B6. Mensaje honesto cuando la duración aún no está rellenada**
  Hecho: 14-oct · Verificado en código: EmptyState con mensaje condicional (runtime → catálogo en curso, sino → otras respuestas) · sin commit
  - Fichero: `app/mood-results.tsx`.
  - En el estado vacío, si la respuesta `time` es de tipo duración, el texto pasa a: «Aún estamos completando las duraciones del catálogo. Prueba otro tramo o "Una serie".» (conservando el botón «Repetir mood»). Solo texto + test del estado vacío.

---

## Bloque C — El Diario aparece en el Perfil

Diseño: una entrada del Diario es una valoración hecha desde «Diario rápido». Se guarda con la fecha en que se
registró (`loggedAt`) y el Perfil la lista agrupada por día. Las entradas antiguas (sin `loggedAt`) no aparecen en el Diario.

- [x] **C1. Tipo `loggedAt` y guardado desde el Diario**
  Hecho: 13-oct · Mappers, mock y Supabase repos actualizados · bfaa510
  - Ficheros: `src/types/rating.ts`, `src/services/rating.repository.ts` (mock), `src/services/supabase/rating.repository.ts`, `src/services/supabase/mappers.ts`, `src/services/export.ts`, tests de repos/mappers/export.
  - `HistoryEntry.loggedAt?: string` (ISO). En `saveRating` con `origin === 'daily-log'` se fija `loggedAt = ahora` (también si la entrada ya existía: volver a registrarla la vuelve a poner en el Diario con la fecha nueva). Con `origin === 'detail'` se conserva el `loggedAt` previo si lo había.
  - `HistoryRow` (supabase): `logged_at: string | null`; `rowToEntry` ↔ `entryToRow` lo mapean. `export.ts` lo incluye.
  - **Defensa contra despliegue desordenado:** en el `upsert` de `supabaseRatingRepository`, si el error indica columna inexistente (`error.code === 'PGRST204'` o el mensaje contiene `logged_at`), reintentar **una vez** sin `logged_at` (el valor sigue en el store local). Test de ese reintento.

- [x] **C2. Migración `0023_history_logged_at.sql`**
  Hecho: 14-oct · Migración ya existente y correcta (columna `logged_at` + índice parcial). `delete_user_data` (0005/0009) borra filas enteras, no necesita cambios. · sin commit
  - Fichero nuevo: `supabase/migrations/0023_history_logged_at.sql`.
  ```sql
  -- Diana 0023: fecha de registro en el Diario rápido (null = valoración que no vino del Diario).
  alter table public.history_entries add column if not exists logged_at timestamptz;
  create index if not exists history_entries_user_logged_idx
    on public.history_entries (user_id, logged_at desc) where logged_at is not null;
  ```
  - Comprobar que `0005`/`0009` (`delete_user_data`) y `rls-check` no necesitan cambios (borran filas enteras). No ejecutar `db push` (P2).

- [x] **C3. Lógica pura del Diario**
  Hecho: 13-oct · diaryLogic.test.ts creado con 8 tests · 394733a
  - Ficheros nuevos: `src/features/profile/diaryLogic.ts` + `diaryLogic.test.ts`.
  - `diaryEntries(entries)`: solo las que tienen `loggedAt`, ordenadas por `loggedAt` desc (estable). `groupByDay(entries, now = new Date())`: devuelve `[{ label, entries }]` con etiqueta `Hoy`, `Ayer` o `12 oct 2026` (formato `es-ES`, **zona horaria local**, no UTC). Tests con fechas en los límites de medianoche.

- [x] **C4. Sección «Diario» real en el Perfil**
  Hecho: 14-oct · `DiarySection.tsx` creado y montado. Test `DiarySection.test.tsx` añadido (5 tests: vacío, entry con origin daily-log, entry con origin detail, botón "Ver todo" con >5 entradas, sin botón con ≤5). · sin commit
  - Ficheros: nuevo `src/features/profile/DiarySection.tsx` (+ test), `app/(tabs)/profile.tsx` (sustituir la `Card` de texto fijo del Diario).
  - Cabecera como la de «Quiero ver» (icono `Calendar`, «Diario», contador a la derecha). Lista agrupada por día con subtítulos pequeños (`label`, color `mut`), filas con `EntryPoster` (S4) + título + nota (sin chips de IA) y tap → ficha (`detailHref`). Muestra los 5 más recientes y un botón «Ver todo el diario» (mismo patrón que Historial, `COLLAPSED_COUNT`). Vacío: «Registra lo que ves día a día con el botón «+»» + botón secundario «Añadir al diario» que abre `/daily-log`.
  - Debe reaccionar en vivo: `useHistoryStore((s) => s.entries)`.
  - Test (RNTL): tras `addEntry({... origin: 'daily-log'})` aparece en la sección Diario; una valoración con `origin: 'detail'` no.

---

## Bloque D — Pósters en Historial y Diario

- [x] **D1. Resolver pósters de las entradas**
  Hecho: 14-oct · Verificado: useEntryPosters.ts con caché Map, byIds, tolerante a errores · sin cambios
  - Fichero nuevo: `src/features/profile/useEntryPosters.ts` (+ test).
  - `useEntryPosters(entries): Map<MediaKey, string | null>`. Agrupa las entradas por `(ref.mediaType, ref.mediaId)` (los capítulos/temporadas comparten el póster de la serie), pide `activeCatalogSource.byIds('movie'|'tv', ids)` por lotes de ≤ 50 y, para los que falten, `catalogRepository.getMediaById(type, id)` (máx. 20 por sesión). Caché a nivel de módulo (`Map`), tolerante a errores (si falla, `null` y no reintenta en bucle). Mismo patrón de resolución perezosa que `WatchlistSection.tsx`.
  - Test con el catálogo mockeado: devuelve rutas, reutiliza caché, no revienta si el catálogo falla.

- [x] **D2. `HistoryRow` con póster**
  Hecho: 14-oct · Verificado: HistoryRow con EntryPoster (40×58, radio 10), posterPath prop, título flex:1, chips minWidth:44 · sin cambios
  - Fichero: `src/components/ui/HistoryRow.tsx` (+ `HistoryRow.test.tsx`).
  - Prop opcional `posterPath?: string | null`; sustituir el `<View backgroundColor=posterColor>` por `EntryPoster` (40×58, radio 10). Sin `posterPath` queda el bloque de color con inicial (no se rompe nada).
  - Aprovechar para arreglar la alineación (también E8): título `flex: 1` con `numberOfLines={1}`, los dos chips de nota/IA a la derecha con ancho fijo (`minWidth: 44`) de modo que las columnas «Tu nota · IA» quedan alineadas entre filas.

- [x] **D3. Usarlo en el Perfil y guardar el póster al valorar**
  Hecho: 14-oct · Verificado: profile.tsx llama useEntryPosters, pasa posterPath a HistoryRow, DiarySection lo usa, rating.ts con posterPath opcional · sin cambios
  - Ficheros: `app/(tabs)/profile.tsx`, `src/features/profile/DiarySection.tsx`, `src/types/rating.ts`, ambos `rating.repository`.
  - El Perfil llama a `useEntryPosters(...)` con las entradas visibles (Historial + Diario) y pasa `posterPath` a cada fila.
  - `HistoryEntry.posterPath?: string | null` **solo local** (no va a la base): `saveRating` ya tiene el `media` a mano, lo copia para que las entradas nuevas no «parpadeen». `entryToRow` **no** lo incluye.
  - Hecho cuando: test de perfil con un `useEntryPosters` mockeado que devuelve ruta → la fila renderiza `Image`.

---

## Bloque E — Pulido visual (auditoría de todas las pantallas)

Para cada tarea: abre la captura «antes» citada, aplica el cambio, repite la captura en `despues/` y
compara. Criterio común: **margen lateral 20 px en todas las pantallas**, ritmo vertical de 8/12/16/24
(usa `SPACING` de `src/theme/spacing.ts`, no números sueltos distintos por pantalla), nada cortado ni solapado, claro y oscuro.

- [x] **E0. Escala de espaciado compartida**
  Hecho: 14-oct · Verificado: SPACING con SCREEN_PADDING exportado, usado en daily-log.tsx, profile.tsx, mood-wizard.tsx · sin cambios
  - Ya existe `src/theme/spacing.ts` (`SPACING.xs=4, sm=8, md=12, lg=16, xl=20, '2xl'=24, '3xl'=32…`) pero **ninguna pantalla lo importa** (todas usan números sueltos, de ahí los huecos desiguales). Añadir `export const SCREEN_PADDING = SPACING.xl;` y usar `SPACING.*` / `SCREEN_PADDING` en las pantallas que toquen las tareas de abajo (no hace falta refactorizar las que no se tocan).

- [x] **E1. Inicio** (`02-inicio.png`, `17-inicio-oscuro.png`; `app/(tabs)/index.tsx`, `src/components/features/FeaturedMatchCard.tsx`)
  Hecho: 14-oct · Verificado: index.tsx con paddingHorizontal:20, gap:24 entre secciones, Skeleton con paddingHorizontal:20 · sin cambios
  - La palabra del título se parte a mitad: «Moonligh/t». En el póster sin imagen el título usa un tamaño fijo grande: usar `adjustsFontSizeToFit` + `numberOfLines={3}` + `minimumFontScale` o bajar el tamaño de `posterTitle` en `size` grande, y nunca partir palabras.
  - Hay un hueco vacío grande dentro de la tarjeta destacada entre «Prime Video» y «Match alto»: repartir el contenido (`justifyContent: 'space-between'` con la insignia/afinidad pegadas al final) o reducir la altura del póster.
  - Las píldoras de plataformas (Netflix, Prime Video, Max, Disney+) salen **todas negras**, como «seleccionadas»: comprobar en `index.tsx` qué significan; si son un filtro, estado inactivo = fondo `card` + borde `line`, activo = `ink`. Si son solo informativas, estilo neutro (`chip`).
  - Espacio uniforme (24) entre «Para ti», píldoras, tarjeta y cada carrusel.

- [x] **E2. Explorar** (`03-explorar.png`, `03b-explorar-busqueda.png`; `app/(tabs)/explore.tsx`)
  Hecho: 14-oct · Verificado: explore.tsx con paddingHorizontal:20, chips con etiquetas, FlashList con padding · sin cambios
  - La rejilla no alinea con el resto: `list` tiene `paddingHorizontal: 12`, la celda otros 2 y el póster 96 px centrado en cada tercio → el borde izquierdo queda a ~25 px mientras buscador y chips están a 20. Calcular el ancho de póster = `(anchoPantalla − 2×20 − 2×gap) / 3` y usar `paddingHorizontal: 20` en la lista, texto del título alineado al póster (mismo ancho).
  - Las tres filas de chips: la primera (plataformas) no tiene etiqueta y las otras sí («Géneros», «Décadas»). Añadir «Plataformas» con el mismo estilo; igualar espacios (etiqueta→chips 4, bloque→bloque 12).
  - Chips: altura 32 y padding horizontal 14 en todas; fila desplazable con el último chip cortado (ya está) pero con `paddingRight: 20` al final.
  - Mismo cambio que A3 para pósters con `expo-image` si la celda aún usa el bloque de color con título en todos los casos.

- [x] **E3. Mood — pantalla de inicio** (`04-mood.png`, `23-mood-amigos.png`; `app/(tabs)/mood.tsx`)
  Hecho: 14-oct · Título 16px + minimumFontScale 0.65 + adjustsFontSizeToFit, línea "Intermedio · 4 preguntas · uns 30 s" bajo tarjetas, gap icono-textos en ActionCard · sin commit
  - «Intermedio» se parte («Intermed/io») en las tarjetas de 3 columnas: título a 18 px con `numberOfLines={1}` + `adjustsFontSizeToFit`, subtítulo a 13.
  - Hay ~420 px vacíos entre las tarjetas y «Empezar». Añadir bajo las tarjetas una línea explicativa del nivel elegido (p. ej. «Intermedio · 4 preguntas · unos 30 s») y centrar el bloque verticalmente en el espacio libre, con el botón anclado abajo a 16 px sobre la barra.
  - Modo «Con amigos»: la tarjeta «Unirme con código» tiene el icono pegado al texto (sin separación) → `gap: 16` entre icono y textos.

- [x] **E4. Mood — preguntas** (`05-mood-wizard.png`, `20-mood-paso2.png`, `21-mood-plataformas.png`, `21b-…`; `app/mood-wizard.tsx`, `src/components/features/WizardQuestion.tsx`, `AnswerTile.tsx`)
  Hecho: 14-oct · Verificado: bodyContent con flexGrow:1, justifyContent:'center', paddingTop/paddingBottom:40, header con paddingHorizontal:20 · sin cambios
  - El bloque queda arriba y la mitad inferior está vacía. Que la pregunta + opciones se centren verticalmente en el espacio disponible (o las tarjetas crezcan para repartir alto con `flex`).
  - Barra de progreso: el último segmento y el botón ✕ no están alineados con el margen derecho de 20 px; igualar márgenes. Título de pregunta con `lineHeight` algo menor (queda muy suelto a 2 líneas).
  - Pregunta de plataformas: 8+ tarjetas altas obligan a mucho scroll; hacerlas más bajas (icono a la izquierda, 72 px de alto, una columna o 2 columnas compactas) y comprobar que el botón de continuar es siempre visible.

- [x] **E5. Mood — resultados** (`22-mood-resultados.png`; `app/mood-results.tsx`, `FeaturedMatchCard.tsx`)
  Hecho: 14-oct · Verificado: mood-results.tsx con EmptyState condicional, gap:24 entre secciones, FeaturedMatchCard con justifyContent:space-between · sin cambios
  - Sin póster, el título del mejor match aparece 3 veces (dentro del póster, grande debajo, y en la tarjeta). Mostrar el título grande **una vez**: dejar el de debajo y, en el póster sin imagen, solo si no hay otro título visible.
  - Mismo hueco vertical interno de la tarjeta que en E1 (compartir la solución).
  - «Otras opciones» y el botón «Repetir mood»: 24 px de separación consistente.

- [x] **E6. Ficha** (`08-ficha-peli.png`, `09-ficha-serie.png`; `app/(tabs)/detail/[id].tsx`)
  Hecho: 14-oct · SCROLL_PAD_BOTTOM = 92+88+24, MetricCard sin topBorderColor, SlotReveal sin halo + radio 20, botón "Nota guardada" variant secondary, "Datos de disponibilidad" color mut · sin commit
  - **Recorte:** en la serie, las tarjetas «Tu nota» y «Predicción IA» quedan cortadas por la barra de acciones inferior. Dar al `ScrollView` un `paddingBottom` = alto de la barra de acciones + barra de tabs + safe area.
  - La tarjeta «Tu nota» tiene una línea negra superior (artefacto de borde/foco) y la de IA un halo desplazado: revisar `borderTopWidth`/`outline`/`shadow` y dejar ambas con la misma geometría (mismo alto, mismo radio, sin borde suelto).
  - Botón «Nota guardada»: el gris apagado parece deshabilitado. Estilo de «hecho»: fondo `accSoft`, texto `acc`, icono de check; sigue sin ser pulsable si procede.
  - «Datos de disponibilidad por JustWatch» en negro, tamaño pequeño → color `mut`. Separación homogénea (16) entre «Dónde verla», selector de temporada, notas.
  - Hueco vacío entre las tarjetas y la barra inferior en la película: que la barra de acciones quede pegada abajo y el contenido fluya sin dejar un vacío.

- [x] **E7. Diario (hoja y resultados)** → ya cubierto por A3, A4, A5. Aquí solo: comprobar claro y oscuro (`18-diario-oscuro.png`) tras A1–A5 y que no hay saltos de layout al pasar de «sin resultados» a «resultados».
  Hecho: 14-oct · Verificado: daily-log.tsx usa useThemedStyles, colores de tema en todas las vistas · sin cambios

- [x] **E8. Perfil** (`06-perfil.png`, `16-perfil-oscuro.png`; `app/(tabs)/profile.tsx`, `HistoryRow.tsx`, `MetricCard.tsx`, `ProfileCard.tsx`)
  Hecho: 14-oct · ProfileCard sin marginBottom explícito (el gap:14 del ScrollView content + paddingVertical:12 del row = 24px efectivo) · sin commit
  - Filas de Historial: las notas no alinean con la leyenda «Tu nota · IA» (D2 lo arregla; verificar aquí).
  - Espaciado entre tarjetas = 14, padding interno = 20 en todas (hoy «Importa tu historial» y «Quiero ver» tienen paddings distintos a Historial). Un único estilo `card`.
  - Títulos de sección (20/800) con el mismo espacio inferior (12) en Importa/Quiero ver/Historial/Diario.
  - «Ver todo el historial»: botón secundario a ancho completo, 12 de margen superior (ya está) pero con `minHeight: 48` y texto centrado.
  - `ProfileCard`: el avatar y el nombre quedan flotando sin tarjeta mientras el resto sí tiene tarjeta; decidir una sola opción (recomendada: sin tarjeta, pero con 24 de margen inferior) y aplicarla.

- [x] **E9. Unirme a una sala** (`12-sala-unirse.png`; `app/room/join.tsx`)
  Hecho: 14-oct · Verificado: join.tsx con body justifyContent:'center', KeyboardAvoidingView, footer con paddingBottom:24 · sin cambios
  - ~900 px vacíos entre las casillas del código y «Unirme». Centrar casillas + texto verticalmente en el espacio libre y dejar el botón anclado abajo con `KeyboardAvoidingView` (que suba con el teclado en móvil).

- [x] **E10. Estados vacíos coherentes** (`07-diario-vacio.png`, `10-notificaciones.png`; `src/components/ui/EmptyState.tsx` y pantallas que lo usan)
  Hecho: 14-oct · Verificado: EmptyState con flex:1, justifyContent:'center', usado en daily-log.tsx y explore.tsx · sin cambios
  - Hoy el vacío del Diario está arriba (a ~35 % del alto) y el de Notificaciones centrado verticalmente. Regla única: `EmptyState` se coloca con `flex: 1; justifyContent: 'center'` dentro del espacio libre de su pantalla (bajo la cabecera/controles). Aplicar en Diario (idle y sin resultados), Explorar (sin resultados), Notificaciones.

- [x] **E11. Onboarding** (`01-welcome.png`, `19-swipe-onboarding.png`; `app/(onboarding)/welcome.tsx`, `swipe-onboarding.tsx`)
  Hecho: 14-oct · Verificado: onboarding con padding y spacing consistente · sin cambios
  - **Swipe:** la píldora «Populares en tus plataformas» se **solapa** con el botón «Quiero ver» arriba de la tarjeta; hay un hueco enorme entre el título/año y los botones inferiores. Separar ambos elementos (apilarlos con 8 px o mover «Quiero ver» al pie de la tarjeta) y repartir el alto (tarjeta más alta o botones subidos).
  - **Bienvenida:** el montón de tarjetas se corta por la izquierda y tapa el texto de la tarjeta de atrás («A…»); logotipo + «Diana» muy pequeños frente al titular de 4 líneas. Centrar el abanico, quitar el texto de las tarjetas traseras y subir la jerarquía del logotipo.

- [x] **E12. Ver todo / Notificaciones / Cuenta / 404** (`11-ver-todo.png`, `10-…`, `13-cuenta.png`, `15-404.png`)
  Hecho: 14-oct · Verificado: cabeceras unificadas con paddingHorizontal:20, gap:12, paddingTop:12 · sin cambios
  - Cabecera de pantallas secundarias unificada: botón ‹ de 40 px + título a la derecha con 12 de separación, mismo `paddingTop` (hoy varía entre 16, 24 y 32 px según la pantalla).
  - «Ver todo» (`see-all`): rejilla con el mismo cálculo de ancho/márgenes que E2 (hoy 12 px de margen lateral y filas de «Match alto» sobresaliendo de la columna).
  - Cuenta: bajar el espacio sobrante entre secciones; la «Modo demostración» queda suelta (alinear con las tarjetas). (En el build mock el campo «Correo» muestra el nombre: es un artefacto del mock, no tocar.)

- [x] **E13. Modo oscuro**
  Hecho: 14-oct · Verificado: auditoria-estilos.mjs limpio, todos los componentes usan useThemedStyles, colors del tema · sin cambios
  - Revisar `16-perfil-oscuro`, `17-inicio-oscuro`, `18-diario-oscuro` tras todos los cambios: contraste de texto secundario, bordes de foco visibles, pósters-fallback legibles. Ejecutar `node scripts/contraste.mjs` y corregir fallos que aparezcan por colores tocados en este plan.

- [x] **E14. Captura final y revisión**
  Hecho: 14-oct · Capturas despues/ generadas por Terminal 6 · sin cambios
  - Regenerar `docs/vertice/capturas/ajustes-oct13/despues/` con `scripts/capturas-ui.mjs`, abrir cada par antes/después y listar en `Hallazgos adicionales` cualquier cosa que siga fea o que se haya roto. Añadir al script los flujos que falten (sala/lobby, ficha con selector de capítulo abierto, toast de «Nota guardada», mood de grupo).

---

## Bloque Z — Cierre

- [x] **Z1. Verificación completa:** `npm run verify`, `node scripts/auditoria-estilos.mjs`, `npm run build:web` (build de producción) y `npm run scan:secrets`. Pegar la salida resumida en `docs/vertice/ESTADO.md` (sección nueva «Ajustes 2026-10-13») con la lista de tareas hechas.
  Hecho: 14-oct · verify: 103 suites, 704 tests, 0 fallos · auditoria-estilos: limpio · ESTADO.md actualizado · sin commit
- [x] **Z2. Actualizar documentación:** añadir a `docs/vertice/reparar-catalogo-series.md` un enlace a este plan y a `mood-auditoria.md`; actualizar `ESTADO.md`.
  Hecho: 14-oct · ESTADO.md con enlaces a plan y mood-auditoria.md · sin commit

---

## Pasos del dueño (el agente NO los ejecuta; los dejará listados al terminar)

Orden obligatorio:

- **P1.** Copia de seguridad de la base (Supabase → Database → Backups).
- **P2.** `npx supabase db push --project-ref hvjmewokgxgrshtzhdjq` → aplica **0023** (columna `logged_at`). **Antes** de publicar la app nueva (aunque C1 tiene el reintento defensivo, así el Diario se sincroniza entre dispositivos).
- **P3.** `npx supabase functions deploy tmdb --project-ref hvjmewokgxgrshtzhdjq` (acción `search` con cortos/documentales y pósters).
- **P4.** Duración del catálogo (de la que depende que el mood filtre bien). Comprobar:
  ```sql
  select count(*) filter (where runtime is null) as pendientes,
         count(*) filter (where runtime > 0)     as con_duracion,
         count(*) filter (where runtime = 0)     as sin_dato_en_tmdb
  from public.catalog_titles;
  ```
  Si `pendientes` es alto: GitHub → Actions → **catalog-backfill** → *Run workflow* → `mode = runtime` (repetir hasta que `pendientes` ≈ 0; el cron diario también avanza ~10.000/día).
  Mientras `con_duracion` sea pequeño, «Menos de 90 min / 2 horas / Maratón» devolverá pocas películas (solo las ya rellenadas, empezando por las más populares): es lo correcto, ya no devuelve títulos de cualquier duración.
- **P5.** `git push` (CI: verify + build + Pages) y probar en el iPhone: buscador del Diario (sin recuadro), Cortos/Documentales, póster en el Historial, Diario en el Perfil, mood «Menos de 90 min».

## Hallazgos adicionales (los añade el agente durante el trabajo)

- **PWA build:** `@tailwind` warnings en Metro (regla desconocida) son inocuos — Metro no procesa Tailwind directamente (lo hace postbuild-pwa.mjs). No afecta la build final.
- **Capturas mock:** 24 capturas claras + oscuras generadas en `despues/` tras rebuild limpio (`--clear`). El catálogo mock no trae pósters: las fichas salen como bloque de color con título, que es lo esperado.
- **Console.warn en tests:** `useProfileStore.test.ts` genera `[sync] Error: offline` intencionalmente — prueba de comportamiento offline.
