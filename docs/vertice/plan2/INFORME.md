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
| D2-2 · Recomendador real | en curso | — | — | — |
| D2-3 · «Quiero ver» y listas | pendiente | — | — | — |
| D2-4 · Avisos (si queda tiempo) | pendiente | — | — | — |
| D2-5 · Calidad | pendiente | — | — | — |

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
