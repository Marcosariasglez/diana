# PROMPT · Plan de acción Diana: recomendador real, Letterboxd y reorganización de tabs

> Copia todo lo que va entre las líneas `---` y pégalo en una sesión nueva de IA (o entrégaselo
> a un agente que trabaje en esta carpeta). Redactado el 2026-10-11 contra el estado real del repo.

---

Eres un ingeniero de software que trabaja en el repositorio de «Diana» (app de películas,
PWA con Expo Router + React Native, backend Supabase). La carpeta del proyecto es
`diana-tmp/`. El repo es público (GitHub: Marcosariasglez/diana, rama `main`) y el
proyecto Supabase es `hvjmewokgxgrshtzhdjq` (datos en `.env.local`: anon key y
service_role; CLI de Supabase autenticado, puedes hacer `supabase functions deploy`).

## Tu trabajo

1. Lee primero: `VERTICE-PLAN-2.md`, `docs/vertice/plan2/INFORME.md` (estado real de
   lo hecho), `docs/vertice/plan2/ARQUITECTURA.md`, `VERTICE-README.md` (contrato
   visual, Parte A y Anexo X: manda en toda pantalla nueva) y `plans/`.
2. Crea el PLAN DE ACCIÓN en `plans/recomendador-letterboxd-tabs.md`: un checklist
   markdown de tareas (`- [ ]`) ordenado en 3 fases (A → B → C), cada tarea con
   «Hecho cuando:» (criterios de aceptación verificables) y los comandos exactos para
   verificar. MÍNIMO 3 tareas por fase. El plan debe ser autoejecutable por una IA:
   sin ambigüedades, con archivos exactos y referencias a los tests existentes.
3. Después, ejecuta el plan en orden, marcando `- [x]` cada tarea completada y
   actualizando el checklist. Si una tarea queda bloqueada, márcala `- [~] bloqueada`
   con el motivo y sigue con la siguiente.

## Estado actual (verificado, no lo re-inventes)

- Plan 2 (D2-0…D2-5) está hecho en código y desplegado: catálogo real `catalog_titles`
  (~27.000 títulos y creciendo; se sincroniza solo: full semanal convergente con
  ventana de 14 días + delta diario vía `.github/workflows/catalog-sync.yml`). NO
  toques la sincronización (hay un run en curso): ni `catalog_sync_state`, ni la
  función `catalog-sync`, ni el workflow.
- Modo catálogo: `EXPO_PUBLIC_CATALOG=tmdb` (real) / mock. El repositorio paginado
  está en `src/services/supabase/catalog/` (browse/search/byIds/candidates).
- Recomendador: ya existe la migración `supabase/migrations/0007_recomendador.sql`
  (tabla `catalog_features` con `embedding vector(384)` + índice HNSW, estado de
  features, y el RPC de recomendación por afinidad), el cliente
  `src/services/recomendador.ts` (interruptor `EXPO_PUBLIC_RECOMMENDER=heuristic|content`),
  y la evaluación offline `scripts/eval-recomendador.mjs` con cifras previas
  (embeddings SINTÉTICOS: heuristic 5.42 EAM / 0.569 p@10; content 3.705 EAM /
  0.444 p@10 → por eso `heuristic` sigue siendo el defecto). PERO `catalog_features`
  está VACÍA: nunca se ha generado la features del catálogo real.
- Import Letterboxd: YA IMPLEMENTADA (`src/services/import.repository.ts` parsea
  ratings.csv/watched.csv/zip, cruza contra el catálogo activo con tolerancia de año,
  UI en `app/(tabs)/profile.tsx` «Subir archivo Letterboxd», códigos de error y
  progreso, tests en `src/services/import.repository.test.ts`). Solo falta verificación
  contra el catálogo real.
- Tabs actuales: `app/(tabs)/` → index (Inicio), mood, match, profile.
  - `mood.tsx`: segmentado «Para mí / Con amigos» (store `useMoodStore`, modo
    solo|group) + tarjetas de afinidad Exprés/Intermedio/Cinéfilo que se OCULTAN en
    modo group; botón «Empezar» (solo → `/mood-wizard`) o «Generar código»
    (group → `useRoomStore.createRoom` → `/room/[code]`).
  - `match.tsx`: hub de salas — «Volver a tu sala» (si hay sala activa), «Crear sala»,
    «Unirme con código» (→ `/room/join`).
  - `explore.tsx` (fuera de tabs, stack-push): chips plataforma/género/década +
    FlashList paginada contra el repositorio del catálogo.
- Manifiesto de rutas: `src/constants/routes.ts` (fuente única para tests y bottom
  nav). Tests sensibles a la nav: `src/__tests__/tabsLayout.test.ts`,
  `src/__tests__/bottomNavVisibility.test.ts`, `src/__tests__/routes.test.ts`,
  `src/__tests__/wireframeFacts.test.tsx`. Componente de nav: `src/components/ui/BottomNav.tsx`.

## FASE A · Recomendador que recomiende de verdad (PRIORIDAD)

Objetivo: `catalog_features` poblado con embeddings REALES de todo el catálogo y el
interruptor `content` activado solo si gana en la evaluación real.

Decisiones a resolver EN EL PLAN (elige una y documéntala en el plan):
- A1. `gte-small` (modelo integrado del runtime de Supabase:
  `new Supabase.ai.Session('gte-small')`, 384 dims, `mean_pool: true, normalize: true`)
  SOLO entiende inglés y trunca a 512 tokens. Las sinopsis del catálogo vienen en
  español (TMDB es). Opciones: (a) pedir a TMDB el `overview` en inglés vía
  `/movie/{id}?language=en-US` en el backfill; (b) embeber `original_title +
  géneros + año + idioma + duración` (sin sinopsis); (c) texto bilingüe
  title+overview_es. Documenta el trade-off y elige (recomendado: (a) si el límite
  de rate de TMDB lo permite con reintentos, fallback a (c)).
- A2. Escala: ~40.000 títulos × 1 embedding. La Edge Function gratuita muere a los
  ~150 s: el backfill debe ser REANUDABLE (patrón del `catalog-sync`: estado en
  tabla, presupuesto por run, workflow «bomba» o loop manual). Estima en el plan el
  tiempo total y la estrategia (p. ej. 50 títulos/run + workflow
  `catalog-features.yml` con la misma bomba que `catalog-sync.yml`, o script local
  que llame a la función en lote).
- A3. Incremental: el delta diario añade títulos nuevos → la función de features debe
  detectar títulos sin features (join anti contra `catalog_features`) y generar solo
  los que faltan.
- A4. Re-ejecutar `scripts/eval-recomendador.mjs` CON EMBEDDINGS REALES (no
  sintéticos) y con valoraciones de prueba; actualizar `docs/vertice/plan2/evaluacion.md`
  con las cifras; activar `content` por defecto SOLO si gana (si no, documentar por
  qué sigue `heuristic`).
- A5. Migración nueva solo si hace falta (no reabrir la 0007); desplegarlo todo
  (migraciones vía SQL Editor del dueño si aplica, funciones con `supabase functions
  deploy` — el CLI está autenticado; documenta cada despliegue en el informe).

Tareas mínimas de la fase A (desgájalas más si hace falta):
- [ ] A.1 Migración/función `catalog-features` (Deno, reanudable, rate-limited,
      protegida por secreto como `catalog-sync`) + tests con fixtures.
- [ ] A.2 Estrategia de texto para embeddings (decisión A1) + tests.
- [ ] A.3 Workflow de bombeo `catalog-features` (reutilizar el patrón de
      `catalog-sync.yml`) + documentación de cómo lanzarlo.
- [ ] A.4 Backfill incremental para el delta diario.
- [ ] A.5 Ejecutar el backfill completo contra producción (verificar recuentos:
      `select count(*) from catalog_features` vs `catalog_titles`).
- [ ] A.6 Re-evaluación real + decisión heuristic/content + actualización de
      `evaluacion.md` y del interruptor por defecto.
- [ ] A.7 Verificación en app: feed en modo `content` muestra candidatos con
      explicación («Porque te gustaron…») y no crashea con perfil nuevo (frío).

## FASE B · Letterboxd contra el catálogo real (verificar y pulir)

Objetivo: que una exportación real de Letterboxd del dueño importe bien contra el
catálogo real y alimente el recomendador.

- [ ] B.1 Flujo completo con un export real del dueño (.csv y .zip) contra
      `EXPO_PUBLIC_CATALOG=tmdb`: medir tasa de coincidencia (filas vistas vs
      coincidentes) y registrar el resumen que ve el usuario.
- [ ] B.2 Si la tasa de coincidencia es baja (<70 %), mejorar el matching (títulos
      originales, normalización de tildes/puntuación ya existe en
      `src/utils/normalizeTitle.ts`; revisar contra el catálogo real, NO contra el mock)
      + tests con casos reales de la exportación del dueño (anonimizar si hace falta).
- [ ] B.3 Verificar que las entradas importadas alimentan `history_entries` con
      `source='letterboxd'` y que el recomendador y el «ya visto» las respetan.
- [ ] B.4 Documentar en el informe: cifras reales de coincidencia y cómo repetir el
      test.

## FASE C · Tabs: Mood unificada + Explorar en la nav (rediseño propuesto por el dueño)

Objetivo: 4 tabs — Inicio · Mood · Explorar · Perfil. Mood es la única entrada a
«solas o con amigos»; desaparece la pestaña Match.

Flujo objetivo (decisión del dueño, ya cerrada):
- Pantalla Mood: título + segmentado «Para mí / Con amigos» + tarjetas de afinidad
  (Exprés/Intermedio/Cinéfilo) SIEMPRE visibles (se eliminan las condiciones de
  visibilidad actuales) + botón principal contextual: «Para mí» → «Empezar»
  (→ `/mood-wizard`); «Con amigos» → «Generar código» (→ sala).
- En modo «Con amigos» (y solo ahí), acciones secundarias que hoy viven en
  `match.tsx`: «Unirme con código» (→ `/room/join`) y, si hay sala activa,
  «Volver a mi sala» (→ `/room/[code]`).
- La afinidad elegida también se aplica en grupo: guardarla en el estado de la sala
  (revisar `useRoomStore` y el RPC `join_room`/fase mood del room: si el room usa
  `GroupMoodView`, documentar cómo consume la afinidad; si no es posible sin
  migración, documentar la limitación en el informe).
- `explore.tsx` pasa a ser pestaña (`app/(tabs)/explore.tsx`), mantiene su contenido
  (chips + lista infinita) y se elimina la ruta stack-push duplicada.
- `app/(tabs)/match.tsx` se elimina; redirigir `/match` a `/mood` (o a `/explore` si
  prefieres la URL corta para la nav: documenta la elección) para no romper enlaces
  antiguos.

Tareas mínimas de la fase C:
- [ ] C.1 Rediseño de `mood.tsx` (segmentado + afinidad siempre + acciones de sala)
      con capturas 390×844 claro/oscuro (contrato visual, Anexo X).
- [ ] C.2 Mover `explore` a `(tabs)/`, actualizar `src/constants/routes.ts`,
      `BottomNav.tsx`, `_layout.tsx` de tabs y todas las navegaciones que apuntaban
      a `/explore` (revisar inicio y otros screens).
- [ ] C.3 Eliminar `match.tsx` + redirección + actualizar tests (`tabsLayout.test.ts`,
      `bottomNavVisibility.test.ts`, `routes.test.ts`, `wireframeFacts.test.tsx`,
      e2e que toquen la nav) SIN debilitar aserciones.
- [ ] C.4 Afinidad aplicada en sala de grupo (o limitación documentada) + tests.
- [ ] C.5 Batería completa: `npm run verify` + `node scripts/auditoria-estilos.mjs`
      + `npm run scan:secrets`, pegar líneas finales tal cual en el informe.

## Reglas de trabajo (NO negociables)

1. Tests primero: cada cambio lleva test que falla sin el cambio. No borres ni
   debilites tests existentes.
2. Batería tras cada tarea: `npm run verify` (typecheck + lint + jest) y
   `node scripts/auditoria-estilos.mjs`; pega las líneas finales tal cual en
   `plans/recomendador-letterboxd-tabs.md`. Sin ellas, la tarea no está hecha.
3. Todo lo visual nuevo sigue el contrato (tokens, radios, filas, fuentes, claro y
   oscuro). Capturas 390×844 en `docs/vertice/plan2/capturas/` (o carpeta nueva
   `docs/vertice/plan2/capturas/tabs3/`).
4. Producción: PUEDES desplegar funciones nuevas (CLI autenticado) después de
   probadas localmente; NO puedes tocar `catalog-sync`, `catalog_sync_state` ni el
   workflow de sync. Migraciones nuevas: escríbelas; si el dueño debe aplicarlas a
   mano en el SQL Editor, deja el SQL listo y el paso exacto en el informe.
5. Secretos nunca en ficheros ni logs (repo público); `npm run scan:secrets` antes
   de commits relevantes. Commits pequeños en español.
6. Si el run de sincronización del catálogo interfiere (p. ej. CPU del plan gratuito
   en Supabase), espera o reintenta: documenta, no parchees la sync.
7. Informe final en el plan: tabla tareas (hecha/partial/bloqueada) con commits,
   cifras reales (recuentos de features, tasa de coincidencia Letterboxd, evaluación
   del recomendador) y qué NO se pudo verificar.
