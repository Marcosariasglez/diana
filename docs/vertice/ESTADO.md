# ESTADO DEL PROYECTO VERTICE · Diana

> Actualizado 2026-10-14T12:21+02:00. **Plan ajustes-oct13 completado (S→Z).**
> **Plan VERTICE terminado.** Quedan solo los pasos de producción del dueño (abajo) y las
> correcciones de cierre de este 2026-10-08.
>
> Este fichero es la **única fuente de verdad del estado**. Los antiguos `PROGRESS.md`,
> `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` se eliminaron el 2026-10-08: lo útil
> quedó absorbido en «Registro histórico (B0–B7)» al final de este documento.

## Plan sin-mock — paquetes P3 y P4 (2026-10-14)

Fuente: `docs/vertice/plan-sin-mock-ejecucion.md` (FASE 2, P3 y P4).

### Variables de CI requeridas (nuevo desde P3)

- `BACKEND=supabase` y `CATALOG=tmdb` en GitHub → Settings → Secrets and variables → Actions → *Variables*.
  **Si faltan o están en `mock`, el guard `Guard against mock` de
  [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) FALLO el deploy a propósito**
  (comportamiento deseado del plan, H6). Desde F4 (P10) solo serán necesarias
  `SUPABASE_URL`/`SUPABASE_ANON_KEY`.
- **Paso del dueño (antes del próximo `git push`):** confirmar en GitHub que
  `BACKEND=supabase` y `CATALOG=tmdb` existen como variables de Actions.

- **P3 (F2-4 + F2-6):**
  - `deploy.yml`: `EXPO_PUBLIC_CATALOG` ahora cae a `'tmdb'` (no `'mock'`) y el paso
    `Guard against mock` falla el build si `BACKEND` o `CATALOG` son `mock`
    (`::error::BACKEND=mock no permitido en deploy` / `CATALOG=mock...`).
  - «Modo demostración» eliminado de `app/account.tsx` y `app/(tabs)/profile.tsx`
    (rama `isMock`, estilos `demoBadge`/`demoText` e imports de `BACKEND` huérfanos).
  - `src/features/profile/resetPrototype.ts` borrado (sin usos en `app/` ni `src/`;
    no tenía test propio — decisión: eliminar sin migración).
- **P4 (F2-3):** en `src/mocks/mock-ai/` el parámetro `catalog` pasa a ser
  **obligatorio** (sin default `= CATALOG`) en: `hiddenGems.ts` (`rankEligible`,
  `pickFeatured`, `pickRecommendations`, `pickHiddenGems`, `pickCategoryItems`,
  `pickFeedPage`), `moodFilters.ts` (`rankMoodResults`, `buildGroupDeckMedia.catalog`)
  y `onboardingDeck.ts` (`getOnboardingDeckMovies`). Ningún llamador de producción
  puede calcular sobre el catálogo falso sin pasar el pool explícitamente.
  Llamadores actualizados: `src/services/catalog.repository.ts` (repositorio mock,
  pasa `CATALOG` explícitamente hasta que muera en P9) y tests
  (`onboardingDeck.test.ts`, `onboardingDeck.coldstart.test.ts`, `seen.test.ts`
  pasan el fixture del mock). `tmdb/catalog.repository.ts` ya pasaba el pool en todos
  los casos: sin cambios.

## Plan sin-mock — paquetes P1 y P2 (2026-10-14)

Fuente: `docs/vertice/plan-sin-mock-ejecucion.md` (FASE 2, P1 y P2).

- **P1 (F2-1):** `mediaFromRpcRow` ([`src/services/recommender.ts`](../../src/services/recommender.ts))
  mapea la fila del RPC **1:1** — eliminado el import de `MOCK_CATALOG` y la sustitución
  `MOCK_CATALOG.find(...)`. El feed nunca vuelve a sustituir un título real por uno del mock.
  Test nuevo F2-1 (`tmdb_id=52` → devuelve el título de la fila, no 'Breaking Bad' del mock) en verde.
- **P2 (F2-2):** La predicción de la ficha usa el modelo real:
  `supabaseRatingRepository.saveRating` ([`src/services/supabase/rating.repository.ts`](../../src/services/supabase/rating.repository.ts))
  llama a `contentPredictTenths` (RPC `predict_tenths`) cuando `activeRecommender() === 'content'`,
  con fallback seguro a la heurística `predictTenths` si devuelve `null` o falla.
  **Feed y predicción comparten modelo (RPC `predict_tenths`) — 2026-10-14.**
  3 tests nuevos en `src/services/supabase/rating.repository.test.ts` (RPC→34, RPC null→heurística,
  entrada existente→sin recalcular). La ficha (`useDetailData.ts`) ya mostraba `saved.aiPrediction`
  del repositorio: sin cambios.

## Ajustes 2026-10-14 (continuación plan-ajustes-oct13.md)

**Plan:** <`docs/vertice/plan-ajustes-oct13.md`> · **Auditoría de mood:** <`docs/vertice/mood-auditoria.md`>

### Verify completo

```
Test Suites: 103 passed, 103 total
Tests:       704 passed, 704 total
```

**Auditoría de estilos:** `✓ Auditoría de estilos: todo limpio.` (0 problemas)
**Build web (producción):** `Exported: dist` · `PWA lista (base "/")`
**Escáner de secretos:** `✓ service_role no filtrada: 302 ficheros revisados en [app, src, public, dist]`
**Contraste WCAG AA:** 5 fallos conocidos (acc/accSoft 4.44:1 claro; neg/negBg y warn/warnBg decorativos 1:1)

### Ajustes visuales E5–E12 (sesión 2026-10-14)

| Tarea | Archivo | Qué se hizo |
|-------|---------|-------------|
| E5 | `FeaturedMatchCard.tsx` | `hideTitle={true}` en `<Poster>` para título único; `gap: 0` en tarjeta; `marginTop: 24` entre "Otras opciones" y "Repetir mood" |
| E6 | `[id].tsx` | `topBorderColor={colors.textSecondary}` (borde "Tu nota" menos agresivo); `color: colors.mut` en JustWatch; `paddingBottom` ScrollView = footer + tabs + safe area |
| E6 | `WatchlistButton.tsx` | Fondo activo `accSoft` (no `acc`); texto/icono `acc` (no `onAcc`) |
| E8 | `profile.tsx` | `paddingTop: 20` (no 24); `marginBottom: 12` en títulos sección |
| E8 | `ProfileCard.tsx` | `marginBottom: 24` en la tarjeta |
| E9 | `room/join.tsx` | `KeyboardAvoidingView` envolviendo contenido; `justifyContent: 'center'` en body; casillas CodeInput ya centradas |
| E10 | `EmptyState.tsx` | Ya tenía `flex: 1` + `justifyContent: 'center'` — verificado sin cambios |
| E11 | `swipe-onboarding.tsx` | `top: 48` (no 64) en píldora "Populares" para evitar solapamiento |
| E11 | `welcome.tsx` | FAN: `translateX ±44` (no ±30) para centrar abanico |
| E12 | `see-all/[category].tsx` | `paddingHorizontal: 20` (no 12) en FlashList; `width: '100%'` + `paddingHorizontal: 2` en celdas |
| FIX | `Poster.tsx` | Reescrito completo para eliminar caracteres Unicode corruptos que rompían TS |

### Tareas anteriores (A–D)

| Tarea | Bloque | Qué se hizo |
|-------|--------|-------------|
| A2 | A | `tmdb/search.repository.ts` con `posterPath`, `searchKinds.ts` (documentary/short), Edge function v2, tests |
| A4 | A | Espaciado del Diario (`bodySmall`, `SPACING['2xl']` para "Resultados de TMDB") |
| A5 | A | BottomSheet con `snapPoints={[0.6]}`, padding correcto |
| B1 | B | `moodFilters.audit.test.ts` (26 tests de auditoría automática) |
| B2 | B | Tramos sin solape (lt90≤89, h2 90-150, marathon≥151), runtime≤0 descartado |
| B3 | B | year≤0 descartado en filtro de época |
| B4 | B | `buildCandidatesQuery` + `moodPoolRuntime` cableados en getMoodResults/getGroupDeck |
| B5 | B | `docs/vertice/mood-auditoria.md` creado |
| B6 | B | Mensaje honesto en `mood-results.tsx` cuando no hay resultados por duración |
| C1 | C | `rating.repository.test.ts` con reintento PGRST204 |
| C2 | C | Migración 0023 verificada correcta |
| C4 | C | `DiarySection.test.tsx` (5 tests RNTL) |
| D1/D2/D3 | D | `useEntryPosters`, `HistoryRow` con `posterPath`, cableados en Perfil |

### Pasos del dueño pendientes

1. Desplegar Edge Function `tmdb` (busca `searchKinds.ts` y caché v2) — requiere `npx supabase functions deploy tmdb`
2. Revisar capturas antes/después en `docs/vertice/capturas/ajustes-oct13/` (manual)

---

## Último verify (tras las correcciones de cierre, 2026-10-08)

```
Test Suites: 72 passed, 72 total
Tests:       418 passed, 418 total
```

**Auditoría de estilos:** `✓ Auditoría de estilos: todo limpio.` (0 problemas)
**Build web (producción, base `/diana`):** `Exported: dist` · `PWA lista (base "/diana")`
**Escáner de secretos:** `✓ service_role no filtrada: 242 ficheros revisados en [app, src, public, dist]`

> Línea base previa (tras D6): `72 passed / 417 passed` (+1 test: comparación del parámetro
> del RPC con la firma de la migración).

## Correcciones de cierre (2026-10-08, post-D6)

| # | Corrección | Evidencia |
|---|------------|-----------|
| 1 | El RPC `delete_user_data` se llamaba con `{ target_user_id }` en la Edge Function y en `rls-check`, pero la migración 0005 declara `p_target_user_id`: en Supabase real era "function not found" y el borrado fallaba. Unificado en las llamadas (sin tocar la migración) + prueba nueva que compara el parámetro de `index.ts` con la firma SQL leyendo ambos ficheros. `rls-check` ahora exige denegación **por permisos** (revoke), no "función inexistente" | 7/7 tests en `delete-account.test.ts`; commit `ef5d901` |
| 2 | La 0005 borraba **todas** las salas huérfanas del sistema. Ahora el borrado de `room_decisions`, `room_members` y `rooms` está restringido a las salas en las que participaba el usuario (miembro o anfitrión), calculadas antes de borrar sus filas. Se editó la 0005 directamente (aún no desplegada): una sola versión canónica, sin 0006 | commit `1e72777` |
| 3 | Limpieza: borrados `build-*.log`, `build2.log`, `serve-3001.log`; `*.log` en `.gitignore`; docs de estado unificadas aquí (se eliminaron `PROGRESS.md`, `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` absorbiendo lo útil sin credenciales) | commit `d7c2cc4` |
| 4 | Logotipo del login/bienvenida: era un círculo (radio 28); el contrato A3.4 dice cuadrado de esquinas redondeadas (34 px radio 11; a 56 px radio 18). Corregido en `login.tsx` y `welcome.tsx` + capturas «después» rehechas (14 PNG: 7 pantallas × claro/oscuro, ahora incluye bienvenida) | commit `826495a` |
| 5 | `seguridad.md`/`paridad.md`/`README.md`: corregida la afirmación de que `rls-check` se ejecutaba «en un proyecto de pruebas» (no existe); el script apunta a producción vía `.env.local` y crea/borra 3 usuarios temporales. Documentado cuándo es seguro ejecutarlo (0005 desplegada + respaldo reciente, sin escrituras en paralelo) | commit `22e0f37` |

## Tabla de fases D0 → D6

| Fase | Estado | Hecho | Evidencia |
|------|--------|-------|-----------|
| **D0 · Red de seguridad** | ✅ Hecho | git limpio, verify línea base, capturas "antes" | 10 PNG + informe.json; línea base: 62 suites/364 tests |
| **D1 · Tokens y tema** | ✅ Hecho | tokens.ts, ThemeProvider, useTheme, appearance v2, fuentes estáticas, typography.ts X3, shadows.ts, colors.ts BORRADO, ESLint anti-hex | grep theme/colors=0; lint 0 warnings |
| **D2 · Componentes al contrato** | ✅ Hecho | Button(ink), Card(r24+sombra), FabButton(58,acc,40%), BottomNav(88,card 92% blur16,ink,FAB+16), SegmentedControl(ink/onInk), Pill/Chip/Toast/BottomSheet, nuevos ListRow/ProfileCard/TextField/ConfirmSheet(frase)/GoogleButton con pruebas, pantallas X5 (títulos 28/800, secciones 19/800+acc, insignias accSoft+acc, posters 20/24, swipe 54, sala pad24) | verify 67/381; auditoría 0 |
| **D3 · Perfil + Cuenta** | ✅ Hecho | account.tsx A5 completa (correo, nombre máx40, exportMyData, cerrar 1/todos, borrar con frase + everywhere), useAuthStore con códigos A4 + signOutEverywhere, storageKey vertice-diana-auth, migración 0005 delete_user_data (corregida: alcance de salas restringido al usuario), profile.tsx con displayName + pie, «Reiniciar prototipo» fuera de producción | verify 72/417; auditoría 0 |
| **D4 · Login A4** | ✅ Hecho | login.tsx A4 (logotipo 56 cuadrado redondeado radio 18, Google, separador, correo, código 6 one-time-code, reenviar 30s, cambiar correo, errores literales de authMessages, pie legal) + 12 pruebas por estado | verify 72/417; auditoría 0 |
| **D5 · Endurecimiento** | ✅ Hecho | rls-check ampliado (initial_ratings, watched, profiles, delete_user_data), `npm run scan:secrets` (242 ficheros, dist incluido), keepalive → consulta anon a Postgres, seguridad.md actualizado | scan:secrets OK; rls ampliado pasa tras `db push` 0005 |
| **D6 · Documentación** | ✅ Hecho | README.md nuevo; **fuentes estáticas corregidas** (las 7 TTF estaban corruptas = HTML; regeneradas con fontTools: `npm run fonts`); capturas "después" 390×844 claro+oscuro de login/inicio/mood/match/perfil/cuenta; **paridad.md** (A8 + X6 punto a punto, comparado contra `referencia/`); build:web de producción; cifras tabulares X3 completadas | 12 PNG + informe.json; paridad A8 marcado; verify 72/417 |

## Pendiente

**Nada del plan.** El plan VERTICE (D0→D6) está terminado.

## Pendientes del dueño (no tocan producción)

**En este orden** (detalle en la sección final de este documento):

1. Copia de seguridad de la base de Supabase (Dashboard → Database → Backups o `pg_dump`)
2. `npx supabase db push --project-ref hvjmewokgxgrshtzhdjq` (migración 0005 `delete_user_data`)
3. `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` + `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` si no está
4. `git push` (CI: verify + build + Pages en `/diana`)
5. Supabase → Authentication: Redirect URLs reales + plantillas «Magic Link»/«Confirm signup» con `{{ .Token }}` + SMTP propio (Resend/Brevo; el SMTP incorporado tiene límite bajo por hora)
6. Prueba real en iPhone/PWA (guion D5 de la Parte C): Google + código por correo, cerrar en todos, exportar, borrar (verificar en BD)
7. Re-ejecutar `npm run rls` cuando haya desplegado 0005 (ahora exige denegación por permisos en `delete_user_data`; crea y borra 3 usuarios temporales)

## Registro histórico (B0–B7, antes del plan VERTICE)

> Absorbido de `PROGRESS.md`, `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md`
> (eliminado 2026-10-08). No contiene credenciales: solo hechos de despliegue.

**Despliegue (activo):**

- Repo: `https://github.com/marcosariasglez/diana` · Pages: `https://marcosariasglez.github.io/diana/`
- Supabase: proyecto `hvjmewokgxgrshtzhdjq`, región West EU (Ireland)
- Google OAuth: configurado; redirect `https://hvjmewokgxgrshtzhdjq.supabase.co/auth/v1/callback`
- Variables de CI (GitHub Actions): `BACKEND=supabase`, `CATALOG=tmdb` (ver `.github/workflows/deploy.yml`)
- PWA instalable en iPhone con sesión persistente

**Fases completadas (B):**

| Fase | Qué se hizo |
|------|-------------|
| B0 · PWA local | Tests + build web + iconos PWA (61 tests en la época) |
| B1 · GitHub Pages | Deploy automático con workflow, URL `/diana` |
| B2 · Login Google | OAuth por redirección PKCE (funciona en la PWA de iPhone) |
| B3 · Datos de usuario | Migraciones 0001–0004 en Supabase (esquema, RLS, RPC, realtime), aislamiento por usuario, bootstrap al login |
| B4 · Salas tiempo real | Repositorios + realtime |
| B5 · TMDB | Edge Function `tmdb` desplegada; repositorios en `src/services/tmdb/` (catalog, search, import, invoke); `genreIndex.ts`; switch mock/tmdb por `catalog.select.ts`; lazy loading en `services/index.ts` |
| B6 · Exportar/borrar | Cumplido en VERTICE D3/D5 (`exportMyData` + `delete-account`) |
| B7 · Letterboxd | Importación CSV/ZIP en bienvenida |

**Migraciones:** 0001–0004 ya estaban en producción; 0005 (`delete_user_data`) pendiente de `db push` (pendiente 2 del dueño).
