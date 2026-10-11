# PLAN DE ACCIÓN · Diana: recomendador real, Letterboxd y reorganización de tabs

> Plan autoejecutable generado a partir de [`PROMPT-recomendador-letterboxd-tabs.md`](./PROMPT-recomendador-letterboxd-tabs.md)
> (redactado el 2026-10-11 contra el estado real del repo). Rama de trabajo: `vertice/recomendador-letterboxd-tabs`
> desde `main`. **Sin `git push`** (aviso expreso antes de cualquier push). Commits pequeños en español.
> Batería obligatoria tras cada tarea (una sola vez, sin paralelismos):
> `npm run verify` + `node scripts/auditoria-estilos.mjs` (+ `npm run scan:secrets` antes de commits relevantes).
> Las líneas finales se pegan tal cual en la sección de cada tarea.

---

## Decisiones documentadas (las que el prompt pedía resolver en el plan)

### A1 · Texto para el embedding — **decisión: (a) overview en EN, con fallback (c) y (b)**

`gte-small` solo entiende inglés y trunca a 512 tokens. Opciones y trade-off:

| Opción | Coste TMDB | Señal semántica | Riesgo |
|---|---|---|---|
| (a) `overview` en EN (`/movie/{id}?language=en-US`) | 1 llamada/título | **Alta** (trama, tono, ambientación) | rate-limit compartido con `catalog-sync` y el proxy `tmdb` (60/min del token) |
| (b) solo metadatos (`original_title` + géneros en EN + año + idioma + duración) | 0 | Baja (títulos de 1–3 palabras) | ninguno |
| (c) bilingüe (`title` + `overview_es` + metadatos) | 0 | Media-baja (prosa en español para un modelo inglés) | ninguno |

**Elegida (la recomendada por el prompt):** por título, **1 llamada de detalle en `en-US`**.
- Si el `overview` EN existe → texto **(a)**: `"{title_en}. {overview_en}"` truncado a 1600 chars (~<512 tokens).
- Si el EN está vacío → **(c)**: `"{title_es}. {original_title}. {overview_es, 1200 chars}. Year {year}. Language: {lang}. Runtime: {runtime} min. Genres: {nombres EN}".` (el `overview_es` se toma de `catalog_titles`, ya guardado).
- Si no hay sinopsis en ninguno de los dos idiomas → **(b)**: `"{original_title}. Year {year}. Language: {lang}. Runtime: {runtime} min. Genres: {nombres EN}".`
- **Géneros en EN:** mapa local constante en la función (id TMDB → nombre EN, películas+series). Sin llamadas.
- **NO se llaman `/keywords` ni `/credits`:** las columnas `keywords`, `director` y `cast_names` de la 0007
  no las usa ningún RPC (el score es `0.7·cos(embedding) + 0.3·afinidad de géneros`); dejarlas en su valor
  por defecto ahorra 2 llamadas/título (~60 % del tiempo del backfill). Documentado para una fase futura.
- Truncado: 1600 chars del overview (gte-small 512 tokens ≈ 380–450 palabras EN). Si el modelo rechaza el
  texto largo, la función lo recorta a 1000 chars y reintenta una vez (defensa barata).

### A2 · Escala y estrategia de bombeo

- Títulos: **~27.000 y creciendo** (recuento exacto en P.0.1). Presupuesto por run: **120 s** y **40 títulos**
  (el wall-clock del plan gratuito es ~150 s; mismo patrón que `catalog-backfill`).
- Ritmo seguro: 250 ms entre llamadas TMDB (~24/min) → ~400–500 ms/título (TMDB + embed + upsert) →
  **~24–30 títulos/run**. Estimación: **~900–1100 runs ≈ 30–37 h continuas**.
- **Orden de candidates: `popularity desc`** → el feed (que muestra lo popular) gana calidad desde la
  primera hora de backfill; la cola larga se completa después.
- **Doble bomba (complementaria, no en paralelo agresivo):**
  1. **Local (primaria, fase inicial):** `node scripts/features-pump.mjs` (nuevo) leyendo
     `CATALOG_FEATURES_SECRET` de `.env.local` (gitignoreado), bucle con `sleep 3 s` mientras `remaining > 0`,
     log en `docs/vertice/plan2/features-pump.log` (`*.log` ya está en `.gitignore`). Se lanza en un terminal
     en segundo plano; es reanudable (el anti-join es la fuente de verdad).
  2. **GitHub (red de seguridad):** workflow `catalog-features.yml` con **cron cada 6 h** + `workflow_dispatch`.
     Mismo patrón de bomba que `catalog-sync.yml`/`catalog-backfill.yml` (repite mientras `remaining > 0`,
     tope 400 iteraciones, 5 reintentos con backoff en 5xx/000, fallo inmediato en 4xx,
     `concurrency: group: catalog-features`, timeout 350 min).
- **Secreto:** la función valida `x-catalog-sync-secret` contra **`CATALOG_SYNC_SECRET` o `CATALOG_FEATURES_SECRET`**
  (cualquiera de los dos esté configurado; si ninguno, 401). Consecuencias:
  - el workflow de GitHub funciona **sin crear ningún secret nuevo** (reutiliza `CATALOG_SYNC_SECRET`,
    ya presente en el repo — es el secreto de la infraestructura de sync del dueño);
  - localmente creo `CATALOG_FEATURES_SECRET` con `npx supabase secrets set` (CLI autenticado; permitido:
    no toca `catalog-sync`/`catalog_sync_state`/el workflow de sync) y lo guardo en `.env.local`.
- **Interferencia con `catalog-sync`:** si un run de la sync compite por el token de TMDB (429) o por la CPU
  del plan gratuito (5xx), la función reintenta con backoff y el próximo run sigue donde quedó. **No se
  parchea ni se toca la sync** (regla 6 del prompt).

### A3 · Incremental (delta diario)

El candidate set SIEMPRE es el **anti-join** `catalog_titles LEFT ANTI JOIN catalog_features`
(independientemente de `catalog_features_state`, que solo sirve de libro de errores/estado). Los títulos
nuevos del delta diario entran solos en el siguiente run. Verificado con test de fixture (A.1) y con
recuentos en producción (A.5).

### A4 · Re-evaluación con embeddings reales

- `node scripts/eval-dump.mjs` (nuevo, **solo lectura** con la anon key): volca los **2.000 títulos más
  populares** que YA tienen feature (title, original_title, overview, genre_ids, year, vote_average,
  vote_count, popularity, **embedding 384-d real**) a `docs/vertice/plan2/eval-dump.json` (gitignoreado:
  son ~10–20 MB y no se versionan embeddings).
- `node scripts/eval-recomendador.mjs --real`: nuevo modo que lee el dump y repite el «dejar uno fuera»
  actual (8 usuarios sintéticos con afinidad de género + ruido, 40 de train, resto holdout) pero con
  **vectores reales de gte-small** y el **catálogo real** (la heurística se corre sobre los mismos
  `Media` del dump con sus géneros reales). Misma métrica: EAM (décimas) + precisión@10.
- **Criterio de activación (el del plan 2):** `content` gana en **las dos** métricas → el defecto de
  `EXPO_PUBLIC_RECOMMENDER` pasa a `content` (defecto en [`src/lib/env.ts`](../src/lib/env.ts) + `.env.local` +
  docs); si no, sigue `heuristic` y se documenta por qué (el cliente ya degrada solo si el RPC falla).
- Si al terminar la sesión el backfill no ha cubierto los 2.000 títulos del dump, el dump usa lo que haya
  (el script lo avisa) y se documenta la cobertura parcial en el informe.

### A5 · Migraciones y despliegues

- **No se reabre la 0007.** Migraciones nuevas de este plan: **solo la 0011** (afinidad de sala, fase C).
- Funciones nuevas a desplegar con `npx supabase functions deploy` (probadas antes en local con fixtures):
  `catalog-features` (fase A). (La 0011 es solo SQL + RPCs; si el CLI no puede aplicarla, queda el SQL
  listo + paso exacto para el dueño.)
- Cada despliegue se documenta en el informe final (qué, cuándo, versión/hash, resultado).

### B · Letterboxd SIN el export real del dueño (no está en el repo y no hay con quién preguntar)

El prompt pide «un export real del dueño», pero no existe en el repo y la orden es no parar ni preguntar.
**Solución documentada:** se construye un export **representativo generado del catálogo real de producción**
(títulos que de verdad están en `catalog_titles`, en el formato exacto de Letterboxd) y se hace el flujo
completo **contra servicios reales** (cruce TMDB vía la función `tmdb` de producción con su
`TMDB_READ_TOKEN`, escritura en `history_entries`/`watched` de un **usuario temporal**, y verificación del
recomendador con los RPCs reales). Lo que **no** se verifica así: los títulos raros/traducidos del historial
personal del dueño (sesgo: el export se genera de títulos que el catálogo ya cubre → la tasa medida es el
techo del pipeline, no la de un archivo real). El informe indica con el comando exacto cómo repetir el test
con el archivo real del dueño cuando lo proporcione.

- **Usuario temporal:** `scripts/letterboxd-real-test.mjs` (nuevo, idempotente): inserta un usuario en
  `auth.users` vía service_role (patrón de `scripts/rls-check.mjs`; el trigger `handle_new_user` crea el
  perfil), genera su JWT con `auth.admin.generateJwt`, ejecuta todo, y al final limpia con el RPC
  `delete_user_data` + borrado del `auth.users` (verificado). **Nunca** toca `catalog_sync_state` ni la sync.
- El export sintético: ~300 `ratings.csv` (con nota 1–5 en pasadas de 0.5) + ~200 `watched.csv`, ambos en el
  formato de Letterboxd (`Date,Name,Year,Link,Rating` / `Date,Name,Year,Link`), y el zip con ambos CSV
  (el flujo `.zip` del prompt).
- **Limitación conocida del pipeline actual (documentar en B.2):** `tmdbImportRepository` solo cruza
  `movie` (la acción `match` hace `/search/movie` y la key siempre es `movie:{id}`); los series de
  `watched.csv` solo cuentan si TMDB las devuelve como película (no: `id null`). Se mide su impacto en la
  tasa y se decide si se mejora (p. ej. `alt_name` + búsqueda por `original_title`, o extensión a `tv`).

### C · Decisiones de tabs

- **Redirección `/match` → `/mood`** (no `/explore`): las acciones que se mudan (unirme con código, volver
  a mi sala) son de salas → pertenecen a Mood; y las 4 pantallas de sala usan hoy `replace('/match')` como
  fallback, que pasa a `replace('/mood')`. `/match` deja de ser pestaña; se crea `app/match.tsx` (fuera de
  `(tabs)`) con `router.replace('/mood')` al montar, y se registra en el manifiesto
  ([`src/constants/routes.ts`](../src/constants/routes.ts)) para no romper enlaces antiguos.
- **Explorar pasa a `(tabs)/`** (tercera pestaña, a la izquierda del FAB, icono `Compass`); se elimina su
  ruta stack-push y su botón «Volver» (ya no aplica en una tab). El layout de la nav queda:
  `[Inicio, Mood, FAB, Explorar, Perfil]`.
- **Afinidad en grupo: SÍ se implementa con migración 0011** (no es «imposible sin migración»):
  - `alter table rooms add column affinity text not null default 'intermedio' check (affinity in ('express','intermedio','cinefilo'))`
  - `create_room(p_name text, p_affinity text default 'intermedio')` — `CREATE OR REPLACE` con parámetro por
    defecto: las llamadas antiguas de 1 argumento siguen funcionando (compatibilidad con clientes ya
    desplegados). El host fija su afinidad en Mood **antes** de generar el código (está en `useMoodStore.complexity`).
  - `confirm_mood` se reemplaza por una versión que valida **por banco de preguntas de la afinidad de la sala**
    (exprés: `time,energy` · intermedio: `time,energy,company,platforms` · cinéfilo: `time,energy,company,era,pace,platforms`)
    — hoy exige las 4 fijas y una sala exprés sería irremediable.
  - `start_match`/`back_to_lobby` no tocan `affinity` (es columna aparte; se conserva).
  - Cliente: `useRoomStore.createRoom()` pasa la afinidad; `RoomSnapshot.affinity` viaja en `fetchSnapshot`;
    `useGroupMood` usa `getQuestionsFor(affinity)`; `selectMoodComplete(affinity)`; el mock repo igual.
  - Test de firma RPC (lección pagada del plan 2): prueba que compara la firma de `create_room` en
    `0011` con la llamada de `supabase/room.repository.ts`.
  - Verificación SQL contra **Postgres local en Docker** (patrón `scripts/sql-recommend-local.mjs`):
    sala exprés confirma con 2 respuestas; sala cinefilo exige 6; la afinidad se guarda; cliente viejo
    (1 arg) sigue creando sala `intermedio`.
- **Mood unificada (C.1):** tarjetas de afinidad **siempre visibles** (se elimina el `group ? null :`);
  botón principal contextual («Empezar» en solo / «Generar código» en grupo); en modo grupo aparecen,
  además, las **acciones secundarias** que vivían en `match.tsx`: «Unirme con código» (→ `/room/join`) y
  «Volver a mi sala · Código XXXX» (→ `/room/[code]`, solo si hay sala activa) como cards de acción
  (mismo estilo de `ActionCard` de `match.tsx`).

---

## FASE 0 · Preparación y comprobación de estado (solo lectura)

- [ ] P.0.1 **Estado de producción (solo lectura, anon key)** — recuentos y despliegue real:
  ```
  curl -s "https://hvjmewokgxgrshtzhdjq.supabase.co/rest/v1/catalog_titles?select=tmdb_id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl -s "https://hvjmewokgxgrshtzhdjq.supabase.co/rest/v1/catalog_features?select=tmdb_id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl -s "https://hvjmewokgxgrshtzhdjq.supabase.co/rest/v1/watchlist?select=user_id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  ```
  (con `Prefer: count=exact` y `Range: 0-0` para contar) → anotar en el informe: nº de `catalog_titles`,
  nº de `catalog_features` (esperado 0), si existe `watchlist`. **Hecho cuando:** cifras anotadas en el
  informe final; si `catalog_features` o `watchlist` no existieran, se aplican la 0007/0008 vía CLI/SQL
  Editor y se deja constancia.
- [ ] P.0.2 **Git:** `git -C diana-tmp status` (notar cambios sueltos, p. ej. `scripts/.tmp-*`), crear rama
  `vertice/recomendador-letterboxd-tabs` desde `main`; `git branch --show-current` = la rama. **Hecho
  cuando:** rama creada y estado inicial anotado en el informe.
- [ ] P.0.3 **Herramientas:** `npx supabase --version`, `npx supabase projects list | head` (autenticación),
  `node --version`, `docker ps` (para los SQL locales). **Hecho cuando:** versiones anotadas; si el CLI no
  está autenticado, las tareas de despliegue pasan a `- [~] bloqueada` con el paso exacto para el dueño.

---

## FASE A · Recomendador que recomiende de verdad (PRIORIDAD)

### A.1 · Edge Function `catalog-features` (Deno, reanudable, rate-limited, protegida) + tests

Ficheros:
- `supabase/functions/catalog-features/index.ts` (nuevo) — patrón de `catalog-backfill/index.ts`:
  secreto por cabecera (`CATALOG_SYNC_SECRET` **o** `CATALOG_FEATURES_SECRET`, ver A2), presupuesto
  (timeMs ≤ 140 s, maxTitles ≤ 40, defaults 120 s/40), **candidates = anti-join por popularity desc**
  (A3), 1 llamada TMDB de detalle `en-US` por título (retry 429/5xx con backoff ×2, `REQUEST_INTERVAL_MS=250`),
  texto según A1 (función pura `buildEmbedText(detail, row)` exportada), embedding con
  `new Supabase.ai.Session('gte-small')` (384 dims, `mean_pool: true`, `normalize: true` — **comprobar la
  forma exacta de llamada en la documentación vigente de Supabase antes de escribirla**), upsert en
  `catalog_features` (`keywords '{}'`, `director ''`, `cast_names '{}'` — ver A1), estado
  `catalog_features_state` (`running`/`done`/`error` + `last_error`), respuesta
  `{ processed, embedded, fallback, errors, remaining }`.
  Inyeccionables para tests: `_setFetchForTest`, `_setSupabaseForTest`, `_setEmbedForTest` (mismo estilo
  que `catalog-backfill`).
- `supabase/functions/catalog-features/catalog-features.test.ts` (nuevo; patrón de
  `supabase/functions/catalog-sync/catalog-sync.test.ts`) — tests con fixtures:
  1. 401 sin cabecera / 401 con secreto equivocado / 200 con cualquiera de los dos secretos.
  2. `buildEmbedText`: caso (a) EN, caso (c) EN vacío → ES, caso (b) sin sinopsis; truncado a 1600;
     géneros en EN desde el mapa local.
  3. Selection: **no** incluye títulos con feature (anti-join) y ordena por `popularity desc`.
  4. Presupuesto: se detiene dentro del budget y el segundo run continúa (reanuda) — el upsert no duplica.
  5. Error de TMDB (404): estado `error` con `last_error`, el título queda pendiente (otra pasada lo reintenta);
     429 → reintento con backoff (medible con el fetch mock).
  6. `remaining` = anti-join exacto tras el lote.

**Hecho cuando:** `npx jest supabase/functions/catalog-features` verde (los tests fallan si se quita el
anti-join, el secreto o el presupuesto); batería completa verde; líneas finales pegadas abajo.
**Verificación:** `npx jest supabase/functions/catalog-features` · `npm run verify` · `node scripts/auditoria-estilos.mjs`

### A.2 · Estrategia de texto para embeddings (decisión A1) + tests

- La lógica vive en `buildEmbedText` (A.1) y su mapa de géneros EN (`src/constants/genresEn.ts` **nuevo,
  puro datos**, para que la función y los tests lo compartan — import relativo desde Deno, como hace
  `catalog-sync` con `providers.ts`).
- Tests adicionales en el mismo fichero de A.1 (ya cubren los 3 casos + truncado).

**Hecho cuando:** los 3 casos de A1 + truncado pasan con fixtures; el mapa de géneros EN cubre los ids de
`src/lib/genreIndex.ts` (prueba de paridad de ids); batería verde.
**Verificación:** `npx jest supabase/functions/catalog-features src/lib/genreIndex` · `npm run verify`

### A.3 · Workflow de bombeo `catalog-features` + documentación

- `.github/workflows/catalog-features.yml` (nuevo) — copia del patrón `catalog-backfill.yml`:
  `schedule: - cron: '0 */6 * * *'` (red de seguridad, ver A2) + `workflow_dispatch` (inputs `timeMs`,
  `maxTitles`); job `timeout-minutes: 350`, `concurrency: { group: catalog-features, cancel-in-progress: false }`;
  bomba: `for i in $(seq 1 400)` → POST `${{ vars.SUPABASE_URL }}/functions/v1/catalog-features` con
  `apikey` + `Authorization: Bearer ${{ vars.SUPABASE_ANON_KEY }}` +
  `x-catalog-sync-secret: ${{ secrets.CATALOG_SYNC_SECRET }}`; 5 reintentos con backoff en 5xx/000;
  fallo inmediato en 401/403/422; `break` cuando `remaining == 0`; log de `[iteración i] processed=… remaining=…`.
- Documentación en `README.md` (sección «Cómo lanzar las features del catálogo»): comando manual del owner
  (workflow_dispatch), qué hace el cron, y el pump local `node scripts/features-pump.mjs`.

**Hecho cuando:** el YAML existe y `actionlint`/revisión manual lo confirma contra el patrón de
`catalog-sync.yml`; README actualizado; batería verde.
**Verificación:** `node -e "import('yaml').then(y=>y.parse(require('fs').readFileSync('.github/workflows/catalog-features.yml','utf8')))"`
(o `npx actionlint` si disponible) · `npm run verify`

### A.4 · Backfill incremental para el delta diario

- Ya es inherente al anti-join (A3/A.1); aquí se **demuestra**:
  - Test de fixture (en `catalog-features.test.ts`): se inserta un título nuevo en el catálogo fake →
    aparece en el candidate set del run siguiente; un título cuya feature se borra → se regenera.
  - En producción (A.5): tras el primer lote, recuento con `scripts/check-features.mjs` (nuevo, solo
    lectura): `count(catalog_features)` vs `count(catalog_titles)` + `%` + nº de `status='error'`.

**Hecho cuando:** el test incremental pasa y `check-features.mjs` existe y corre contra producción
(salida en el informe).
**Verificación:** `npx jest supabase/functions/catalog-features` · `node scripts/check-features.mjs` · `npm run verify`

### A.5 · Backfill completo contra producción (despliegue + bombeo)

Pasos exactos (en este orden):
1. `npx supabase functions deploy catalog-features` (después de los tests de A.1/A.2 en local).
2. Generar un secreto local: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` →
   `npx supabase secrets set CATALOG_FEATURES_SECRET=<valor>` y **añadirlo a `.env.local`** (gitignoreado;
   **nunca** a fichero versionado). `npm run scan:secrets` tras esto.
3. Lanza el pump en segundo plano desde `diana-tmp`:
   `start "" cmd /c node scripts/features-pump.mjs >> docs\vertice\plan2\features-pump.log 2>&1`
   (el script lee `.env.local`, bucle con `sleep 3 s` mientras `remaining > 0`, y **no** lo detiene nadie:
   el anti-join lo hace idempotente).
4. `node scripts/check-features.mjs` a los 2–3 min → el recuento debe ser **> 0 y creciente**; repetir al
   terminar la sesión para el informe.

**Hecho cuando:** función desplegada (URL responde 401 sin secreto), secreto en producción, pump en
segundo plano con `embedded > 0` en el log, recuento creciente anotado en el informe (cifras de
`check-features.mjs` tal cual). El 100 % del catálogo se alcanza cuando el pump/cron termina
(`remaining = 0`); la cobertura de esa noche queda registrada en el informe final.
**Verificación:** `node scripts/check-features.mjs` · `npm run scan:secrets` · batería completa

### A.6 · Re-evaluación real + decisión heuristic/content + `evaluacion.md`

1. `node scripts/eval-dump.mjs` → `docs/vertice/plan2/eval-dump.json` (gitignoreado; añadir patrón a `.gitignore`).
2. Añadir el modo `--real` a `scripts/eval-recomendador.mjs` (A4): mismos usuarios sintéticos y métricas,
   vectores reales del dump, catálogo real; la réplica JS del modelo content usa los embeddings del dump
   (misma identidad algebraica que `_user_taste_vector`); la heurística usa `predictTenths` con los
   `Media` del dump. El script escribe la sección «## Resultados con embeddings REALES (gte-small)» en
   [`docs/vertice/plan2/evaluacion.md`](../docs/vertice/plan2/evaluacion.md) (conservando la historia sintética).
3. **Decisión:** si `content` gana en EAM **y** p@10 → cambiar el defecto de
   [`src/lib/env.ts`](../src/lib/env.ts) a `content` (test en `env.test.ts` que el defecto es el ganador) +
   `.env.local` + docs; si no, documentar por qué sigue `heuristic` (y mantener la degradación
   automática).

**Hecho cuando:** `evaluacion.md` tiene la sección real con cifras, la decisión está aplicada y
documentada, tests de `env.test.ts`/`recommender.test.ts` sin cambios de aserción rota; batería verde.
**Verificación:** `node scripts/eval-dump.mjs` · `node scripts/eval-recomendador.mjs --real` · `npm run verify`

### A.7 · Verificación en app: feed en `content` con explicación + arranque en frío

1. **Cablear `explanation`:** `MediaWithAffinity.explanation?: string[]` (nuevo, opcional) en
   [`src/types/media.ts`](../src/types/media.ts); `useFeedStore.loadFirstPageContent` lo propaga (featured +
   carril); [`FeaturedMatchCard`](../src/components/features/FeaturedMatchCard.tsx) recibe `explanation` y
   pinta la primera línea como texto `bodySmall` `textSecondary` bajo la plataforma (1 línea, `numberOfLines=1`)
   — solo si no está vacía (contrato: no añade bloques nuevos, reutiliza la tarjeta existente).
2. **Frío:** con 0 valoraciones el RPC devuelve scores 0 (orden por popularidad) → el feed `content` debe
   mostrar «populares» sin crashear.
3. Tests (fallan sin el cambio):
   - `useFeedStore.test.ts`: caso `content` con RPC → featured + carril **llevan `explanation`**; caso
     `content` con scores 0 (frío) → `status 'ready'` y sin throw.
   - Test de componente: `FeaturedMatchCard` con `explanation` muestra «Porque te gustó …»; sin ella, no
     pinta nada nuevo (y `wireframeFacts.test.tsx` sigue verde — no se debilita).
4. Capturas 390×844 claro/oscuro de Inicio con el feed `content` (build supabase simulado del arnés e2e si
   el `supabaseMock` permite añadir `POST /functions/v1/recommend`; si no es viable sin reescribir el
   arnés, capturar la tarjeta destacada con explicación vía un test de render → PNG y **documentar** que
   la captura de pantalla completa en `content` real queda pendiente del backfill completo). Carpeta:
   `docs/vertice/plan2/capturas/tabs3/`.

**Hecho cuando:** los tests nuevos pasan; el feed `content` real (con features ya generadas por el pump)
responde al RPC en producción (verificable con el JWT del usuario temporal de B, o con una llamada
`recommend()` solo-lectura desde un script); capturas en la carpeta; batería verde.
**Verificación:** `npx jest src/store/useFeedStore src/components/features/FeaturedMatchCard` ·
`npm run verify` · `node scripts/auditoria-estilos.mjs`

---

## FASE B · Letterboxd contra el catálogo real (verificar y pulir)

### B.1 · Flujo completo (.csv y .zip) contra `CATALOG=tmdb` con el export del dueño

> El export real del dueño no está en el repo (no hay con quién preguntar → ver decisión B). Se ejecuta el
> flujo contra **servicios reales** con el export sintético del catálogo real (techo del pipeline) y el
> comando exacto para repetirlo con el archivo real.

- `scripts/letterboxd-real-test.mjs` (nuevo):
  1. Crea el usuario temporal (service_role; `auth.users` + `generateJwt`), lee `.env.local`.
  2. **Solo lectura (anon):** muestrea ~500 `movie` de `catalog_titles` (mezcla top-popular + cola) y genera
     `ratings.csv` (~300, notas 1–5 pasos 0.5, fechas reales de Letterboxd `YYYY-MM-DD`) y `watched.csv`
     (~200 sin nota) en formato Letterboxd exacto, más `export.zip` con ambos (JSZip, ya dependencia).
  3. Ejecuta el **repositorio real** `tmdbImportRepository.parseLetterboxd` (carga TS vía transpile, como
     hace `eval-recomendador.mjs`; `openFile` monkeado para leer de disco; `getSupabase` con el JWT del
     usuario temporal) → cruza contra TMDB **real** vía la función `tmdb` de producción (batches de 40).
  4. Mide: `totalRows`, `matched`, `unmatched`, `alreadyPresent`, `watchedOnlyMatched` → **tasa de
     coincidencia** = `(matched + watchedOnlyMatched) / totalRows`; captura la **cadena del resumen que ve
     el usuario** (`importSummary(result)`).
  5. Escribe en producción lo que vería la app: `supabaseProfileRepository.saveImport` (upsert
     `history_entries` con `source='letterboxd'` + `watched`) con el JWT del usuario temporal.
  6. Limpieza (al final, en el mismo script o paso separado documentado): `delete_user_data` RPC
     (service_role) + `delete from auth.users` + verificación de que quedaron 0 filas suyas.

**Hecho cuando:** el script corre de punta a punta; cifras de coincidencia y el resumen tal cual en el
informe; el `.zip` da el mismo resultado que los `.csv` sueltos; limpieza verificada (0 filas del usuario
temporal en `history_entries`, `watched`, `profiles`, `auth.users`).
**Verificación:** `node scripts/letterboxd-real-test.mjs` (salida completa en el informe) ·
`npm run verify`

### B.2 · Tasa de coincidencia < 70 % → mejorar matching (si aplica)

- Con la tasa de B.1:
  - **≥ 70 %** → documentar que no hay que tocar el matching (los casos `unmatched` se listan: suelen ser
    títulos sin entrada TMDB o series malinterpretadas como película) y **por qué** el export real del
    dueño podría dar menos (sesgo de la muestra, ver B).
  - **< 70 %** → mejorar: (1) en `tmdbImportRepository`, pasar también `original_title` como `alt_name` a
    la acción `match` (la función `tmdb` la acepta como segundo intento si el nombre falla — cambio
    **aditivo** en `supabase/functions/tmdb/index.ts`, re-desplegarla; la app no se rompe porque el campo
    es opcional); (2) revisar `normalizeTitle` contra los casos reales `unmatched` (sin inventar: cada
    regex nueva con test). Tests: `import.repository.test.ts` / el nuevo test del repo tmdb con **los casos
    reales** de la ejecución de B.1 (anonimizados si hiciera falta, p. ej. sustituyendo el nombre por
    otro con la misma estructura).
- **Hecho cuando:** se cumple una de las dos ramas, con tests; batería verde; líneas finales en el informe.
**Verificación:** `npx jest src/services` · `npm run verify`

### B.3 · Las importadas alimentan `history_entries` (`source='letterboxd'`) y las respeta el recomendador

Con el usuario temporal **antes de la limpieza** (re-ordenar B.1/B.3 o re-crear el usuario):
1. Recuento (service_role): `select count(*) from history_entries where user_id = $u and source = 'letterboxd'`
   y de `watched` → en el informe.
2. **Recomendador respeta lo importado:** con el JWT del usuario temporal, `rpc('recommend')` →
   **ningún** candidato está entre las keys importadas (ni vistas ni valoradas) y `explanation` no es vacía
   (ya hay valoraciones sobre la media con features, si el backfill cubre esas titles; si no, documentar).
   `rpc('predict_tenths', …)` sobre una title importada → smallint 10..50.
3. **«Ya visto» respeta el import:** las keys de `watched` importadas no aparecen como candidatos (mismo
   chequeo 2) y el contexto de ranking del feed local (`getRankingContext`) las cuenta como vistas
   (test local existente de `useFeedStore`/`rankingContext` cubre la lógica; aquí se demuestra en
   producción).

**Hecho cuando:** los 3 puntos verificados contra producción con la salida en el informe (recuentos +
cero solapes + predicción válida).
**Verificación:** `node scripts/letterboxd-real-test.mjs --verify` (subcomando que hace solo el punto 1–3
   sobre el usuario ya importado, sin re-importar) · `npm run verify`

### B.4 · Informe: cifras reales de coincidencia y cómo repetir el test

- Sección en el informe final: tasa de coincidencia (ratings y watched por separado), resumen de usuario
  literal, casos `unmatched` notables, y el comando para repetir **con el archivo real del dueño**:
  `node scripts/letterboxd-real-test.mjs --file=C:\ruta\letterboxd\export.zip` (el script acepta `--file`
  y salta la generación sintética) — **Hecho cuando:** la sección existe en el informe final.
**Verificación:** lectura del informe (revisión manual al cierre)

---

## FASE C · Tabs: Mood unificada + Explorar en la nav (rediseño del dueño)

### C.1 · Rediseño de `mood.tsx` + capturas 390×844 claro/oscuro

- [`app/(tabs)/mood.tsx`](../app/(tabs)/mood.tsx):
  - Tarjetas Exprés/Intermedio/Cinéfilo **siempre visibles** (se elimina la condicional `group ? null :`);
    la selección sigue en `useMoodStore.complexity` (en grupo se usará en C.4).
  - Botón principal contextual (sin cambios de lógica): solo → «Empezar» (`/mood-wizard`); grupo →
    «Generar código» (ahora **pasando la afinidad**: `useRoomStore.createRoom(complexity)` — ver C.4).
  - **Solo en modo grupo**, bajo las tarjetas: actions cards (reutilizando el estilo `ActionCard` de
    `match.tsx`): «Unirme con código» (→ `/room/join`) siempre; «Volver a mi sala · Código XXXX»
    (→ `/room/[code]`) solo si `useRoomState({navigate:false})` da `status==='active' && code`.
  - Contrato visual (Anexo X): márgenes 20, radios de la tabla X4, botones X2, tokens solo; oscuro sin sombras.
- Tests (fallan sin el cambio): `useMoodStore` ya cubre mode/complexity; añadir test de render de
  `mood.tsx`: en modo grupo las cards de afinidad **siguen visibles** (hoy no lo están → la aserción
  falla antes del cambio) y las actions de sala aparecen solo en grupo.
- Capturas 390×844 claro/oscuro (mock, `scripts/capturas.mjs` actualizado: quitar la entrada `match`,
  conservar `mood` y `explorar`; añadir `mood-group` con el seed de `diana.mood.v1` en modo group) →
  `docs/vertice/plan2/capturas/tabs3/`.

**Hecho cuando:** tests de render pasan; capturas (4 imágenes) en la carpeta; batería verde; líneas
finales en el informe.
**Verificación:** `npx jest src/__tests__ src/store/useMoodStore` · `npm run verify` ·
`node scripts/auditoria-estilos.mjs`

### C.2 · `explore` a `(tabs)/` + manifiesto + nav + navegaciones

- Mover `app/explore.tsx` → `app/(tabs)/explore.tsx`; **quitar el botón «Volver»** y su cabecera de
  `goBack` (es tab: cabecera tipo `screenTitle` sin back, resto idéntico: chips + FlashList).
- [`src/constants/routes.ts`](../src/constants/routes.ts):
  - `/explore` → `file: 'app/(tabs)/explore.tsx'`, `presentation: 'tab'`, `bottomNav: true`.
  - `/match` → `file: 'app/match.tsx'` (nuevo), `presentation: 'stack-fade'`, `bottomNav: false`.
- [`src/components/ui/BottomNav.tsx`](../src/components/ui/BottomNav.tsx): `NAV_TABS` =
  `[index Inicio, mood Mood, explore Explorar (Compass), profile Perfil]`; la posición del FAB se mantiene
  (slot central entre Mood y Explorar).
- [`app/(tabs)/_layout.tsx`](../app/(tabs)/_layout.tsx): `<Tabs.Screen name="explore" />` en lugar de `match`.
- **Nuevas rutas que apuntaban a `/match`** (todas a `/mood`): `app/room/join.tsx`,
  `app/room/[code]/index.tsx`, `app/room/[code]/mood.tsx`, `app/room/[code]/swipe.tsx`.
- `app/match.tsx` (nuevo): `useEffect(() => { router.replace('/mood'); }, [])` + render nulo/`Screen`
  vacío (los enlaces antiguos no rompen).
- [`scripts/capturas.mjs`](../scripts/capturas.mjs): quitar `{ name: 'match', … }` (ya no existe como tab).
- [`src/components/ui/Gallery.tsx`](../src/components/ui/Gallery.tsx): `NAV_PROPS` fixture → `explore`
  (coherencia; no rompe tests).
- Revisar otras navegaciones a `/explore` (Inicio no lo usa; el `EmptyState` de «Explorar» de la galería es
  un `onPress` fake — sin cambio).

**Hecho cuando:** `app/explore.tsx` ya no existe; todas las rutas de `/match` redirigen; batería verde
(incluidos `routes.test.ts` y `bottomNavVisibility.test.ts` **actualizados**, no debilitados — ver C.3).
**Verificación:** `npm run verify` · `npx jest src/__tests__/routes src/__tests__/bottomNavVisibility`

### C.3 · Eliminar `match.tsx` + redirección + tests SIN debilitar aserciones

- `git rm app/(tabs)/match.tsx` (sus acciones ya están en Mood, C.1).
- Tests a actualizar (mismas aserciones, nuevas tablas esperadas — **sin bajar cobertura**):
  - `src/__tests__/tabsLayout.test.ts`: las 4 tabs declaradas = `['index','mood','explore','profile']`.
  - `src/__tests__/bottomNavVisibility.test.ts`: ficheros de `app/(tabs)` =
    `['detail/[id].tsx','explore.tsx','index.tsx','mood.tsx','profile.tsx']`.
  - `src/__tests__/routes.test.ts`: manifiesto consistente (el fichero `app/match.tsx` existe; `/explore`
    es tab; sigue pasando «no hay archivos fuera del manifiesto»).
  - `src/components/ui/BottomNav.test.tsx`: `TABS` y el `navigate('explore')`.
  - `src/store/feedMood.test.ts`: lista de rutas con bottomNav = `/`, `/mood`, `/explore`, `/profile`,
    `/detail/[id]` (sigue `toHaveLength(20)` — el manifiesto mantiene 20 filas).
  - `wireframeFacts.test.tsx`: **sin cambios** (no depende de tabs); debe seguir verde.
  - e2e: ningún spec toca la tab Match (verificado: solo `getByRole('tab', {name:'Perfil'})`); si
    `npm run e2e` se ejecuta, no debe añadir fallos nuevos respecto a la línea base del informe D2-0.

**Hecho cuando:** `match.tsx` eliminado; los 5 tests actualizados pasan (y la aserción de cada uno sigue
verificando lo mismo, solo con la tabla de tabs nueva); batería verde.
**Verificación:** `npx jest src/__tests__ src/components/ui/BottomNav` · `npm run verify`

### C.4 · Afinidad aplicada en sala de grupo + tests (migración 0011)

1. **`supabase/migrations/0011_room_affinity.sql`** (nueva; ver decisión C):
   `alter table rooms add column affinity text not null default 'intermedio' check (affinity in
   ('express','intermedio','cinefilo'))`; `create_room(p_name text, p_affinity text default 'intermedio')`
   (CREATE OR REPLACE, validación de valor, insert con la columna); `confirm_mood` reemplazada con
   validación por banco de la sala (`case r.affinity`); permisos igual que en 0003.
2. **Cliente:** `useRoomStore.createRoom(affinity?)` (por defecto la `complexity` de `useMoodStore`);
   `supabase/room.repository.ts` → `rpc('create_room', { p_name, p_affinity })`; `fetchSnapshot` lee
   `affinity` → `RoomSnapshot.affinity` (default `'intermedio'`); mock `room.repository.ts` igual;
   `useGroupMood` → `getQuestionsFor(affinity)` y `selectMoodComplete(affinity, …)` (nueva firma opcional
   en `useRoomStore`); `app/(tabs)/mood.tsx` genera el código con la afinidad elegida.
3. **Tests (fallan sin el cambio):**
   - `room.repository.test.ts` (supabase): la llamada a `create_room` incluye `p_affinity` y la **firma
     coincide con el SQL 0011** (prueba que lee el fichero del SQL y compara parámetros — lección del
     plan 2).
   - `roomRobustness.test.ts` / `useRoomStore.test.ts`: sala creada con `express` → `moodComplete` exige
     solo `time,energy`; con `cinefilo` → las 6; `confirmMood` con sala exprés y 2 respuestas acepta.
   - `useGroupMood`: las preguntas del hook siguen la afinidad del snapshot (fixture de snapshot con
     `affinity='express'` → 2 preguntas).
4. **SQL contra Postgres local (Docker)** — `scripts/sql-affinity-local.mjs` (nuevo, patrón de
   `sql-recommend-local.mjs` con `sql-recommend-setup.sql`): aplica 0001+0003+**0011**; verifica:
   `create_room` con 1 arg → `affinity='intermedio'`; con `'express'` → se guarda; `confirm_mood` en sala
   exprés con solo `time,energy` → OK; sin `time` → `mood-incomplete`; cinefilo exige las 6.
5. **Despliegue 0011:** intentar `npx supabase db push` (o aplicar el SQL vía CLI); si no es posible,
   dejar en el informe el SQL listo + el paso exacto del dueño (SQL Editor). **No afecta a la sync.**

**Hecho cuando:** los 3 bloques de tests pasan + el script local contra Postgres sale `OK`; la batería
verde; el estado del despliegue 0011 documentado en el informe (aplicada / pendiente del dueño).
**Verificación:** `npx jest src/services/supabase/room.repository src/store/useRoomStore
src/features/room` · `node scripts/sql-affinity-local.mjs` · `npm run verify`

### C.5 · Batería completa + auditoría + informe

- `npm run verify` (typecheck + lint + jest) — **pegar las líneas finales tal cual**.
- `node scripts/auditoria-estilos.mjs` — **pegar la línea final tal cual**.
- `npm run scan:secrets` — **pegar la línea final tal cual** (antes del commit final; el pump usa
  `.env.local` que no se versiona).
- `npm run e2e` si el arnés lo permite (documentar si no, como en D2-0: fallos preexistentes listados).

**Hecho cuando:** las tres salidas tal cual en el informe y los commits de la fase C listados.
**Verificación:** los 3 comandos arriba

---

## Reglas de trabajo (las del prompt, no negociables)

1. Tests primero (que fallen sin el cambio). No borrar ni debilitar tests existentes.
2. Batería tras cada tarea; líneas finales tal cual en este plan.
3. Contrato visual en todo lo nuevo; capturas 390×844 claro/oscuro en
   `docs/vertice/plan2/capturas/tabs3/`.
4. Producción: desplegar funciones nuevas tras probarlas en local; **NUNCA** tocar `catalog-sync`,
   `catalog_sync_state` ni `.github/workflows/catalog-sync.yml` (ni `catalog-backfill`). Migraciones
   nuevas: escribir + documentar (y aplicar si el CLI lo permite).
5. Secretos nunca en ficheros versionados ni logs; `npm run scan:secrets` antes de commits relevantes;
   commits pequeños en español.
6. Si la sync del catálogo interfiere (CPU del plan gratuito): esperar/reintentar; documentar, no parchear.
7. Informe final: tabla de tareas (hecha/partial/bloqueada) con commits, cifras reales (recuentos de
   features, tasa Letterboxd, evaluación del recomendador) y qué NO se pudo verificar.

---

## Informe final (se rellena durante la ejecución)

| Tarea | Estado | Commits | Evidencia / líneas finales | Qué no se pudo verificar |
|-------|--------|---------|----------------------------|--------------------------|
| P.0.1–P.0.3 | | | | |
| A.1 | | | | |
| A.2 | | | | |
| A.3 | | | | |
| A.4 | | | | |
| A.5 | | | | |
| A.6 | | | | |
| A.7 | | | | |
| B.1 | | | | |
| B.2 | | | | |
| B.3 | | | | |
| B.4 | | | | |
| C.1 | | | | |
| C.2 | | | | |
| C.3 | | | | |
| C.4 | | | | |
| C.5 | | | | |

### Pasos pendientes del dueño (con comandos exactos, si aplican)
(relleno: p. ej. aplicar 0011 si el CLI no pudo; push/merge de la rama; repetir B con el export real
`node scripts/letterboxd-real-test.mjs --file=…`; comprobar el fin del backfill con
`node scripts/check-features.mjs`)
