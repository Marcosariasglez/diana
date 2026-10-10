# VERTICE · Plan 2 de Diana: catálogo completo y recomendador real

> **Para el agente que trabaja solo durante varias horas.** Redactado el 2026-10-09. Contexto: el plan VERTICE (diseño, cuentas, legal) ya está hecho y publicado. Este plan es de **producto**. Lee antes `VERTICE-README.md` (Parte A y Anexo X: contrato visual, que sigue mandando en toda pantalla nueva), `VERTICE-NOCHE.md` (reglas de autonomía, repítelas aquí) y `docs/vertice/` (ESTADO, seguridad, `contrato-delete-account.md`).

---

## 0 · Reglas (las mismas del turno anterior; léelas dos veces)

Nadie te contestará. No preguntes ni esperes. Si algo se bloquea, anótalo en `docs/vertice/plan2/INFORME.md` y pasa a la siguiente tarea.
1. Rama `vertice/plan2` desde `main`. **Sin `git push`, sin merge a `main`, sin reescribir historial.** Commits pequeños en español, con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
2. **Producción intocable.** Nada de `supabase db push`, `functions deploy`, `secrets`, ni consolas. **No hay proyecto de pruebas de Supabase: `.env.local` apunta a producción. No ejecutes `npm run rls` ni nada que escriba en Supabase.** Migraciones y funciones se **escriben y se prueban en local** (simulaciones y fixtures); el dueño las despliega.
3. Pruebas primero (que fallen sin el cambio). No borres ni debilites pruebas existentes.
4. Batería tras cada tarea, **una sola vez, sin ejecuciones en paralelo**: `npm run verify` (hoy 73 suites / 429 tests) y `node scripts/auditoria-estilos.mjs`. Pega **las líneas finales tal cual**; sin ellas no digas «verde».
5. Secretos: nunca en ficheros ni logs. El repositorio es **público**. `npm run scan:secrets` antes de commits relevantes.
6. **Lecciones pagadas:** el PKCE devuelve `?code=` en la query; una prueba con un simulador no prueba la integración real y hay que decirlo; la firma de un RPC y su llamada deben coincidir (añade una prueba que las compare); los E2E de este repo **no están demostrados** (en esta máquina el navegador se cuelga): no los des por válidos, y los nuevos, si los escribes, indícalo así.
7. **Todo lo visual nuevo sigue el contrato** (tokens, radios, filas, fuentes estáticas, claro y oscuro). Capturas 390×844 en `docs/vertice/plan2/capturas/`.
8. Trabaja solo en esta carpeta. No uses claves que no estén en `.env.local`.

**Dato opcional para el dueño:** si antes de lanzar este plan añade `TMDB_READ_TOKEN=…` a `.env.local` (ignorado por git), podrás **leer** de TMDB (solo GET) para verificar identificadores y formas de respuesta reales. Si no está, trabaja con fixtures **sin inventarte las formas de respuesta**: sácalas de la documentación de TMDB v3 y márcalas como «no verificadas contra la API real».

---

## 1 · Diagnóstico (verificado leyendo el código)

El catálogo está limitado por diseño, y por eso no ves Filmin ni casi nada de otras plataformas:

| Hecho | Dónde | Consecuencia |
|---|---|---|
| El «pool» es **un único conjunto de unos 150–400 títulos** que la Edge Function `tmdb` calcula de una vez (`action: 'pool'`) con unas pocas páginas de `discover` | `supabase/functions/tmdb/index.ts` (`buildPool`), `src/services/tmdb/catalog.repository.ts` (`getPool`, comentario «unos 150 títulos de las 4 plataformas») | Toda recomendación, búsqueda por plataforma y mood opera sobre ese puñado |
| Los `discover` ordenan por **popularidad** y exigen `vote_count ≥ 50–100` | misma función | Los catálogos de nicho (Filmin, MUBI, Criterion…) tienen pocos votos: **nunca entran** |
| El filtro de plataformas es `with_watch_providers=<todos los del PROVIDER_MAP>` y solo `flatrate` | misma función | Un solo filtro para todas: gana siempre Netflix/Prime. No hay alquiler/compra |
| `PROVIDER_MAP` mezcla ids de TMDB con plataformas que no son de España (`zee5`, `hotstar`, `vidAngel`, `peacock`…) y su comentario dice «Verificar con action providers» | misma función | Algunos ids pueden estar mal o ser irrelevantes: **hay que verificar**, no suponer |
| El pool se cachea 24 h en `tmdb_cache` y el cliente lo carga entero al abrir | `invoke.ts`, `catalog.repository.ts` | No escala a un catálogo grande: hay que pasar a **consultas paginadas** |
| La «IA» es una heurística determinista de gustos con ruido pseudoaleatorio (`src/mocks/mock-ai/*`) | `mock-ai/taste.ts`, `predict.ts` | La «nota IA» no usa señales reales del título más allá de géneros |

---

## 2 · Tareas (en este orden)

### D2-0 · Deuda inmediata
1. Estás en `main` (limpio salvo, quizá, `app/account.tsx`: corrección del rótulo «APARICENCIA» → «APARIENCIA»). Commitéala primero en `vertice/plan2`.
2. **Pantalla Cuenta en la web de escritorio:** el dueño informó de que, en su navegador, no ve «Apariencia» ni «Cerrar sesión» (están en el código, bajo «Información»). Sospecha: el contenedor no tiene altura acotada y el `ScrollView` no desplaza, o el CSS del simulador móvil de `global.css` apunta a `#__next` (en Expo Router web el raíz es `#root`). Reprodúcelo **de verdad** (Playwright con un viewport de escritorio 1280×720 y otro móvil, sesión simulada y **seed de `hasOnboarded: true`** para llegar a Inicio: el arnés de `e2e/` actual se queda en la bienvenida) y arréglalo si es real. Añade una prueba que verifique que con 1280×720 se puede llegar al botón «Cerrar sesión» (scrollIntoView + clic).
**Hecho cuando:** reproducido, causa explicada, arreglo y prueba.

### D2-1 · Catálogo completo de España en la base de datos (**la tarea principal**)
Objetivo: que cada plataforma de España tenga **todo** su catálogo, y que Filmin, MUBI, Criterion… aparezcan.
1. **Verifica los proveedores.** Usa la acción `providers` (`/watch/providers/movie` y `/tv` con `watch_region=ES`) para obtener la lista real de plataformas de España con su `provider_id`, nombre y logo. Reescribe `PROVIDER_MAP`/`src/constants/platforms.ts` desde esa lista (quita las que no operan en ES; incluye **Filmin**, MUBI, Movistar Plus+, SkyShowtime, Atresplayer, RTVE Play, Max, Netflix, Prime Video, Disney+, Apple TV+, Paramount+, Rakuten, Plex, YouTube…). Un único origen de verdad compartido por la función y el cliente (genera uno desde el otro o añade una prueba que los compare).
2. **Esquema** (migración nueva `supabase/migrations/0006_catalogo.sql`, **solo escrita, no desplegada**): tabla `catalog_titles` (`tmdb_id`, `media_type`, `title`, `original_title`, `year`, `overview`, `genre_ids int[]`, `vote_average`, `vote_count`, `popularity`, `runtime`, `poster_path`, `backdrop_path`, `original_language`, `platforms_flatrate text[]`, `platforms_rent text[]`, `platforms_buy text[]`, `updated_at`), con índices (GIN en `platforms_*`, `genre_ids`; FTS en español con `unaccent`/`pg_trgm` sobre título), **RLS de solo lectura para `anon` y `authenticated`** (es catálogo público) y **sin escritura desde el cliente**. Tabla `catalog_sync_state` (por proveedor y tipo: última página, fecha, total).
3. **Función de sincronización** `supabase/functions/catalog-sync/index.ts` (Deno, con `service_role` del entorno de la función): para **cada proveedor** de ES y cada tipo (película/serie), recorre `discover` con `with_watch_providers=<id>`, `watch_region=ES`, `with_watch_monetization_types=flatrate` (y otra pasada para `rent|buy`), **sin mínimo de votos**, ordenando por `primary_release_date`/`popularity`, y **parte la consulta por rangos de fechas y géneros** para superar el tope de TMDB (≈500 páginas × 20 resultados por consulta). Upsert por lotes. **Reanudable** (guarda el progreso en `catalog_sync_state`; una ejecución procesa un presupuesto de tiempo/páginas y continúa en la siguiente), con límite de ritmo respetuoso con TMDB, reintentos con espera, y protegida (cabecera con secreto de sincronización; nunca ejecutable por un usuario normal). Modo `delta` diario (novedades y cambios de disponibilidad) y `full` semanal.
4. **Disparo programado:** workflow de GitHub `.github/workflows/catalog-sync.yml` (cron + `workflow_dispatch`) que llama a la función con el secreto, **o** `pg_cron` + `pg_net` si lo prefieres; documenta ambos y elige uno. Sin desplegar.
5. **Cliente:** sustituye `getPool()` por un repositorio paginado (`catalog.repository` con RPC/PostgREST): `browse({platform?, genre?, decade?, sort, cursor})`, `search(query)` (FTS + trigram), `byIds`, y **«disponible en tus plataformas»** como filtro. El motor de mood/feed/grupo deja de cargar un pool fijo y consulta candidatos filtrados (p. ej. 300–1.000 candidatos relevantes por consulta, no todo el catálogo).
6. **Pantallas:** «Explorar por plataforma» (chips de plataforma con logo → lista paginada infinita con `FlashList`), filtros de género/década/duración, y en la **ficha**: «Dónde verla» (flatrate/alquiler/compra con logos). Cumple el contrato visual y las medidas del Anexo X.
7. **Atribución obligatoria de TMDB** (sus condiciones de uso): texto «Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB» con su logo, en Perfil/Cuenta (pie) y en las páginas legales; y «Datos de disponibilidad por JustWatch» donde se muestre «Dónde verla».
8. **Comprobación de cobertura:** `scripts/verify-catalog.mjs` (usa el token solo si existe) que, por cada proveedor de ES, compara `total_results` de TMDB con las filas de la base y falla si faltan más del 5 %; y una prueba con fixtures que verifique que la sincronización pagina, parte por rangos, reanuda y no duplica.
9. **Límites del plan gratuito:** estima el tamaño (filas × bytes) y anótalo (el límite de base de datos es 500 MB; compruébalo en la documentación vigente). Si el catálogo completo supera lo razonable, prioriza por popularidad dentro de cada plataforma y documenta el corte.
**Hecho cuando:** migración y función escritas y probadas con fixtures, cliente paginado funcionando en modo `mock` y contra el simulador, pantallas con capturas claro/oscuro, atribución visible y `INFORME.md` con lo que **no** se pudo comprobar contra TMDB/Supabase reales.

### D2-2 · Recomendador real (el paso grande)
La «nota IA» actual es una heurística de géneros con ruido. Sustitúyela por un modelo **basado en contenido** y medido:
1. **Señales por título** (en `catalog_titles` o tabla aparte `catalog_features`): géneros, palabras clave de TMDB (`/keywords`), director y primeros actores (`/credits`), década, idioma original, duración, y un **embedding de la sinopsis** (extensión `pgvector`; genera el embedding en la Edge Function con el modelo `gte-small` integrado del runtime de Supabase, que no requiere clave externa: **verifica en la documentación vigente que sigue disponible**). Columna `embedding vector(384)` con índice HNSW. Migración nueva.
2. **Perfil de gusto del usuario**: vector medio de los títulos que valoró, **centrado en su media** (una nota de 4,5 empuja hacia el título; una de 1,5 lo aleja), más pesos por director/actor/género. Función SQL `recommend(...)` con `security invoker` (respeta RLS: solo ve las valoraciones del propio usuario) que devuelve candidatos ordenados por afinidad dentro de sus plataformas, con paginación y **explicación** («Porque te gustaron X e Y»).
3. **Predicción de nota**: calibra el score a la escala 1–5 (en décimas, como hoy) con una regresión simple por usuario cuando hay ≥ 20 valoraciones, y un prior (nota media del título ponderada por votos) cuando hay pocas. Mantén el contrato `predictTenths`/`bucketOfTenths` para no romper pantallas.
4. **Evaluación offline obligatoria** (`scripts/eval-recomendador.mjs`): con un conjunto de valoraciones (usa los datos de prueba y, si existen, ficheros de Letterboxd de ejemplo sintéticos), hace «dejar uno fuera» y mide **error absoluto medio** y **precisión@10** frente a tres líneas base: la heurística actual, la nota media del título y el azar. **El modelo nuevo debe ganar a la heurística actual**; si no, no se activa por defecto y se documenta. Resultados en `docs/vertice/plan2/evaluacion.md`.
5. **Arranque en frío:** el mazo inicial (onboarding) usa títulos populares y diversos del catálogo completo; con 0 valoraciones muestra «populares en tus plataformas».
6. Interruptor de funcionalidad (`EXPO_PUBLIC_RECOMMENDER=heuristic|content`), por defecto el que gane en la evaluación.
**Hecho cuando:** evaluación documentada con cifras reales (no inventadas), pruebas de la función SQL con datos sintéticos (simuladas o con un Postgres local si hay Docker; si no, di cuál no pudiste ejecutar), cliente conectado con el interruptor.

### D2-3 · «Quiero ver» y listas
1. Tabla `watchlist` (usuario, tipo, id, fecha, notas) con RLS propia y alta/baja desde la ficha y desde las tarjetas (gesto o botón). Pestaña/sección «Quiero ver» en Perfil con filtro «disponible ahora en mis plataformas».
2. Listas propias con nombre (opcionales: pueden esperar si el tiempo se acaba).
3. Incluir las tablas nuevas en **exportar mis datos** y en `delete_user_data` (con la prueba de que borra solo lo del usuario: amplía la migración 0005 con cuidado: **no está desplegada aún** y es la única editable; si ya se desplegó, crea una nueva).

### D2-4 · Avisos (si queda tiempo)
«Ya está en tu plataforma»: cuando un título de `Quiero ver` pasa a estar disponible en una plataforma del usuario (comparando `platforms_flatrate` entre sincronizaciones). Primero **dentro de la app** (bandeja de avisos); las notificaciones push en iPhone exigen PWA instalada (iOS 16.4+) y Web Push: investígalo y deja una propuesta sin implementar.

### D2-5 · Calidad
- Si quedan, lista los módulos de `src/` sin pruebas y cubre los críticos (`src/store/*`, `src/services/*`).
- Documenta en `docs/vertice/plan2/ARQUITECTURA.md` el flujo catálogo → sincronización → cliente → recomendador.
- `README.md`: variables nuevas, comandos, cómo lanzar la sincronización.

---

## 3 · Pasos que solo puede hacer el dueño (déjalos listos con comandos exactos en el informe)
1. Copia de seguridad; aplicar migraciones **a mano en el SQL Editor** (el `db push` no funciona en este proyecto porque 0001–0004 se aplicaron a mano: usa `supabase migration repair` antes si quiere usarlo).
2. Activar extensiones en Supabase → Database → Extensions: `pg_trgm`, `unaccent`, `vector`.
3. `supabase functions deploy catalog-sync` y `tmdb`; poner el secreto de sincronización (`supabase secrets set CATALOG_SYNC_SECRET=…`; **no** puede llevar el prefijo `SUPABASE_`) y el mismo valor en un secreto del repositorio de GitHub.
4. Lanzar la primera sincronización completa (`workflow_dispatch`) y comprobar el recuento con `scripts/verify-catalog.mjs`.
5. Poner `EXPO_PUBLIC_CATALOG=tmdb` ya está; añadir la variable del recomendador si procede, y `git push`.

## 4 · Informe final
`docs/vertice/plan2/INFORME.md`: tabla de tareas (hecha / parcial / bloqueada), commits de la rama, líneas finales de `verify` y auditoría, **cifras reales de la evaluación**, qué no se pudo comprobar contra servicios reales, y los pasos del dueño con comandos exactos. Nada que no hayas ejecutado.
