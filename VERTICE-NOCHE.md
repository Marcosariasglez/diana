# VERTICE · Plan de trabajo autónomo de Diana (`diana-tmp`)

> **Para el agente que trabaja solo, sin supervisión, durante varias horas.** Redactado el 2026-10-08 tras revisar a fondo los dos repositorios.
> **Este documento añade tareas; no sustituye a `VERTICE-README.md`.** La **Parte A** de `VERTICE-README.md` (contrato visual, pantalla de acceso A4, pantalla de cuenta A5, identidad A6) y su **Anexo de medidas X1–X6** siguen siendo la referencia y **ganan ante cualquier duda**. Léelos antes de empezar, junto con `docs/vertice/` (ESTADO, paridad, seguridad) y `docs/vertice/referencia/` (capturas y CSS de Norte).

---

## 0 · Reglas de autonomía (leer dos veces)

**Nadie te va a contestar mientras trabajas. No hagas preguntas, no esperes confirmaciones, no termines tu turno hasta acabar la lista o agotar lo que puedas hacer.** Si una tarea se bloquea, regístralo en `docs/vertice/noche/INFORME.md` (qué intentaste, qué falló, qué necesitas) y **pasa a la siguiente**.

1. **Rama de trabajo:** crea `vertice/noche` desde `main` y trabaja ahí. **No hagas `git push`, no hagas merge a `main`, no reescribas historial.** Un commit pequeño por tarea o subtarea, mensaje en español, terminado con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
2. **Producción intocable.** Nada de `supabase db push`, `supabase functions deploy`, `supabase secrets`, ni cambios en las consolas de Supabase, Google o GitHub. **No existe proyecto de pruebas de Supabase:** `.env.local` apunta a **producción**. Por eso **no ejecutes `npm run rls` ni ningún script que escriba en Supabase** (crea y borra usuarios temporales en el proyecto real). Todo se prueba con simulaciones locales; lo que exija producción queda como «pendiente del dueño» con el comando exacto.
3. **Pruebas primero.** Cada cambio de comportamiento lleva pruebas que **fallan sin el cambio y pasan con él** (compruébalo de verdad). No borres ni debilites pruebas existentes.
4. **Batería tras cada tarea**, **una sola vez y sin otras ejecuciones en paralelo** (en paralelo se agotan los tiempos y salen fallos falsos de suites): `npm run verify` y `node scripts/auditoria-estilos.mjs`. Pega **las líneas finales tal cual** en el informe. No escribas «verde» sin pegarlas. Referencia actual: **72 suites / 418 tests**.
5. **Capturas** al tocar interfaz: 390×844, claro y oscuro, en `docs/vertice/capturas/noche/`, con `BACKEND=mock` (usa `scripts/capturas.mjs`).
6. **Secretos**: nunca en ficheros, logs ni informes. La `anon key` y la URL de Supabase son públicas; la `service_role` **nunca** fuera de `.env.local` y de los secretos del servidor. Este repositorio es **público** en GitHub: todo lo que escribas lo ve cualquiera. Ejecuta `npm run scan:secrets` antes de cada commit relevante.
7. **Lecciones ya pagadas (no las repitas):**
   - El flujo PKCE de Supabase devuelve el código en la **query** (`?code=…`), no en el hash. Los tests deben simular **lo que hace el sistema real**.
   - Un «fallo» sin demostrar no es «preexistente»: compáralo con un commit anterior.
   - Las pruebas con el cliente de Supabase simulado no prueban la integración real: dilo en el informe.
   - La firma de un RPC (`p_target_user_id`) y su llamada deben coincidir: hubo un fallo así que las pruebas con simulación no detectaron. Cuando añadas RPC o funciones, añade una prueba que compare firma y llamada leyendo ambos ficheros.
   - Los dos proyectos (Diana y Norte) comparten **el mismo proyecto de Supabase** y el mismo dominio de GitHub Pages. Mantén `storageKey: 'vertice-diana-auth'`, `emailRedirectTo`/`redirectTo` a `/diana/`, y no toques nada de Norte.
8. **Trabaja solo dentro de esta carpeta** (`diana-tmp`). No leas ni busques rutas fuera.
9. **Orden de prioridad**: haz **D-1 a D-7** completas antes de tocar D-8.

**Informe continuo:** mantén `docs/vertice/noche/INFORME.md` con una fila por tarea (`hecha / parcial / bloqueada`, commits, líneas finales de pruebas, qué no se pudo comprobar y por qué). Es lo único que leerá el dueño por la mañana: que sea veraz y breve.

---

## 1 · Estado de partida (verificado el 2026-10-08)

- Pruebas: `npm run verify` → **72 suites, 418 tests**, lint y typecheck sin avisos; `scripts/auditoria-estilos.mjs` limpia. El repo local va 1 commit por delante de `origin/main`.
- **Hecho** (plan VERTICE D0–D6): tema claro/oscuro (`src/theme/tokens.ts`, `ThemeProvider`), tipografía estática Manrope/Inter, componentes al contrato, pantalla de acceso A4, pantalla Cuenta A5 (`app/account.tsx`), exportar datos, cerrar sesión (1 / todos), borrar cuenta con frase, Edge Function `delete-account` (borra solo datos de Diana; `everywhere:true` borra además la identidad), migración `0005_delete_user_data.sql` (RPC `delete_user_data(p_target_user_id uuid)` restringido a `service_role`), `rls-check` ampliado, README, `docs/vertice/*`, capturas.
- **Pendiente del dueño (NO lo hagas tú):** `supabase db push` (0005), `supabase functions deploy delete-account`, plantillas de correo y SMTP en Supabase, prueba en iPhone, `git push`.
- **Hallazgos de la revisión que debes corregir** (están en las tareas):
  1. En la captura `docs/vertice/capturas/despues/cuenta-*.png` la fila «Correo» muestra el **nombre** («Marcos») dentro de un campo, no el correo de solo lectura (A5).
  2. Los enlaces «Política de privacidad» y «Términos» son **texto sin enlace** (`app/account.tsx`, login): no existen las páginas.
  3. Solo hay capturas de 6 pantallas; el resto (ficha, wizard, resultados, sala, swipe, notificaciones, ver-todo, diario rápido, bienvenida) no está auditado en oscuro.
  4. `plans/vertice-D2aD6-plan.md` está versionado y sobra; `DECISIONS.md` y `SERVICES_DOCS.md` siguen en la raíz con información histórica.
  5. No hay prueba de integración del callback de Google en la web (`?code=…`): hubo un bucle de acceso en Norte por exactamente eso.
  6. El `PLAN_TMDB_SINCRONIZACION.md` tiene casillas sin marcar y nadie ha verificado el modo `CATALOG=tmdb` localmente.
  7. `handle_new_user` crea un perfil de Diana para quien se registre en Norte (la identidad es común): decisión pendiente, ver D-7.

---

## 2 · Tareas

### D-1 · Higiene y limpieza
1. `git switch -c vertice/noche`. Borra `plans/` (el contenido útil, si lo hay, pasa a `docs/vertice/historico/`). Mueve `DECISIONS.md` y `SERVICES_DOCS.md` a `docs/vertice/historico/` **revisando que no contienen claves ni datos sensibles** (el repo es público); si contienen algo sensible, elimínalo del fichero y apúntalo en el informe.
2. `.gitignore`: `dist/`, `*.log`, `test-results/`, `playwright-report/`, `.expo/`; comprueba `git status` limpio tras un `build:web`.
3. Actualiza `README.md` con la estructura real y el comando de pruebas (una sola ejecución, sin paralelo).
**Hecho cuando:** `git status` limpio, batería en verde.

### D-2 · Pruebas de extremo a extremo con Playwright (la deuda más importante)
`npm run verify` solo ejecuta pruebas unitarias con Supabase simulado: no demuestra que el navegador funcione. Crea una suite E2E **separada** (`npm run e2e`, no incluida en `verify` ni en el workflow de despliegue, para no frenarlo):
1. Sirve `dist/` de `npm run build:web` con `BACKEND=supabase` y **simula las llamadas HTTP de Supabase** con `page.route` (`/auth/v1/token`, `/auth/v1/otp`, `/auth/v1/verify`, `/auth/v1/user`, `/auth/v1/logout`, `/rest/v1/*`, `/functions/v1/*`). Las simulaciones deben reproducir las **respuestas reales** (forma de las sesiones y errores de GoTrue).
2. Escenarios mínimos: (a) acceso sin sesión → `/login`; (b) **vuelta de Google con `?code=…&state=…` en la URL** → canjea, llega a la bienvenida u Inicio, limpia la URL y no vuelve a `/login`; (c) código por correo: enviar, error de código, código correcto; (d) cerrar sesión limpia stores y storage (`diana.*`, `vertice-diana-auth`); (e) cerrar en todos los dispositivos (`scope:'global'`); (f) borrar cuenta: hay que escribir `BORRAR MI CUENTA`, se llama a `/functions/v1/delete-account`, y el cuerpo es `{ everywhere:false }` (y `true` en el enlace secundario); (g) exportar: se descarga un JSON válido; (h) cambiar Apariencia persiste tras recargar; (i) **sin errores de consola ni de red inesperadas** en todo el recorrido.
3. Un escenario de **no mezcla**: con la sesión de otra aplicación (clave `vertice-norte-auth` en `localStorage`) presente, Diana no la usa ni la borra al cerrar sesión.
**Hecho cuando:** `npm run e2e` pasa 3 veces seguidas y está documentado en el README.

### D-3 · Auditoría visual completa, claro y oscuro (todas las pantallas)
1. Ampliar `scripts/capturas.mjs` para capturar **todas** las pantallas con datos de prueba: bienvenida, swipe de onboarding, Inicio, Mood, wizard (cada paso), resultados, Match, sala (lobby, mood de grupo, swipe de grupo), ficha de película y de serie, slot machine (bloqueada, rodando, revelada), diario rápido, Perfil, Cuenta, notificaciones, ver todo, 404, estados vacío/error/cargando. Claro y oscuro (≈ 40 imágenes).
2. Revisa **cada una** frente al contrato (A3, Anexo X1–X5) y a `docs/vertice/referencia/`. Corrige cualquier diferencia: márgenes ≠ 20, radios fuera de la tabla X4, pesos de letra, colores fijos que rompan el oscuro, texto ilegible sobre pósters, sombras en oscuro, barra inferior.
3. **Contraste WCAG AA automático:** script `scripts/contraste.mjs` que lea `tokens.ts` y calcule la razón de contraste de **todas** las combinaciones de texto/fondo usadas (`mut`/`card`, `ink`/`bg`, `onInk`/`ink`, `acc`/`accSoft`, `neg`/`negBg`…) en claro y oscuro; falla por debajo de 4.5:1 (3:1 para texto grande). Corrige o documenta.
4. Axe: `@axe-core/playwright` (devDependency) sobre las pantallas web principales; corrige violaciones serias o críticas.
**Hecho cuando:** capturas «noche» de todas las pantallas, tabla de diferencias en `docs/vertice/paridad.md` (corregida / aceptada con motivo) y contraste en verde.

### D-4 · Pulido de Perfil y Cuenta
1. **Fila «Correo» (A5):** debe mostrar el **correo** en solo lectura (con el subtítulo según el proveedor real: «Entras con Google» / «Entras con código por correo», leído de `session.user.app_metadata.provider`), no un campo editable con el nombre. Comprueba también «Nombre» (editable, máx. 40, se guarda al salir del campo y actualiza el perfil).
2. **Páginas legales:** crea `public/privacidad.html` y `public/terminos.html` (autónomas, con el estilo VERTICE y modo claro/oscuro con `prefers-color-scheme`, sin scripts externos) y **enlázalas de verdad** (`Linking.openURL` en nativo y `<a>` en web) desde el pie de la pantalla de acceso, Cuenta y Perfil. Cada página lleva un cartel visible «BORRADOR pendiente de revisión por el responsable» y **no inventa datos del responsable** (deja `[RELLENAR: …]`). Debes describir con exactitud qué guarda Diana (correo y nombre de la cuenta, valoraciones, historial, salas) y qué servicios intervienen (Supabase, TMDB). Las debe revisar el dueño: esto no es asesoría legal.
3. Quita del Perfil de producción todo resto de «prototipo»; el modo mock muestra «Modo demostración».
4. **Enlace «Borrar también mi acceso a todas las apps de VERTICE»:** comprueba que el aviso dice que afecta también a Norte y que exige la frase escrita.
**Hecho cuando:** capturas «noche» de Perfil, Cuenta y las dos páginas legales, y pruebas de componente para cada cambio.

### D-5 · Robustez de los flujos principales
1. **Salas en tiempo real** (`src/features/room/*`, `src/services/supabase/room.repository.ts`): pruebas (con el cliente simulado) de reconexión, salida de un miembro, anfitrión que se va, sala llena, código inexistente, doble envío de decisión; y estados de interfaz para «sin conexión» y «reconectando».
2. **Errores de sincronización:** `reportSyncError` debe llegar al usuario de forma discreta (Toast) sin bloquear. Cubre con pruebas que un fallo de `saveProfile`/`saveInitialRating`/`removeEntry` no pierde el dato local ni rompe la pantalla.
3. **Importación de Letterboxd:** prueba con archivos grandes (≥ 5.000 filas), CSV malformado, ZIP sin el CSV esperado, cancelación; la barra de progreso no congela la interfaz.
4. **Estados vacíos, de error y de carga** en todas las listas y carriles (usa `EmptyState`, `ErrorState`, `Skeleton`), con la composición del Anexo X5.
5. **Modo `CATALOG=tmdb`:** verifica localmente con la Edge Function simulada lo que se pueda de `PLAN_TMDB_SINCRONIZACION.md`; marca las casillas verificables y deja las de producción como «pendiente del dueño». Prueba que si la función falla, la app muestra un error recuperable y no una pantalla vacía.
**Hecho cuando:** pruebas nuevas para cada punto y lista en el informe de lo no comprobable sin producción.

### D-6 · PWA e instalación (iPhone y Android)
1. `scripts/postbuild-pwa.mjs` genera `manifest.json` y etiquetas: comprueba y completa `name`, `short_name`, `start_url` y `scope` con la ruta `/diana/`, `display: standalone`, `theme_color`/`background_color` (`#0B7A66`/`#F4F3EF`) y **`<meta name="theme-color">` con `media` para claro y oscuro**, iconos 192/512 y **maskable**, `apple-touch-icon` opaco (sin transparencia), `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`.
2. **Service Worker mínimo** con alcance `/diana/` (solo caché del «cascarón» de la app, **nunca** de respuestas autenticadas ni de `/auth/v1/*`), con versión que invalide la caché en cada despliegue y una pantalla sin conexión. Prueba E2E: tras la primera carga, sin red, la app muestra el cascarón/pantalla sin conexión y vuelve al recuperar red. **Cuidado:** el SW debe ser compatible con `/diana/` y no interferir con el de Norte (mismo dominio, distinta ruta).
3. Auditoría de instalación con Lighthouse (o equivalente) en `dist/`: anota puntuaciones y corrige lo que bloquee la instalación.
**Hecho cuando:** manifest válido, SW probado, informe con lo no comprobable en dispositivo real.

### D-7 · Supabase: revisión de esquema y seguridad (solo en local)
1. Relee `supabase/migrations/0001…0005` y `supabase/functions/*` buscando: RPC `security definer` sin `set search_path`, sin comprobar `auth.uid()`, o con permisos abiertos a `anon`/`authenticated` que no deban; políticas RLS que dejen leer filas ajenas; `on delete cascade` que borre más de lo previsto al eliminar la identidad. Cada hallazgo → arreglo en una migración nueva **solo si es inevitable** (las migraciones ya desplegadas no se editan; la `0005` aún no se ha desplegado y es la única editable) + prueba que compare firmas y llamadas.
2. **`handle_new_user`:** con identidad común, quien se registre por Norte también obtiene un perfil de Diana. **Decisión por defecto:** se deja como está (es inocuo y simple) y se documenta en `docs/vertice/seguridad.md`; solo cámbialo si encuentras un riesgo real.
3. **`delete-account`:** comprueba el manejo de errores cuando falla el borrado de la identidad después de borrar los datos (la respuesta debe indicarlo), que valida el JWT, que `CORS` no permite métodos de más y que el cuerpo se valida (`everywhere` solo booleano). Añade pruebas (`delete-account.test.ts` ya existe: amplíalo).
4. **Contrato con Norte:** escribe `docs/vertice/contrato-delete-account.md` (petición, respuesta, errores, CORS) porque Norte llamará a esta función desde su navegador con `{ everywhere: true }` para «borrar mi acceso VERTICE».
5. Escribe `supabase/README.md` con los pasos exactos de despliegue para el dueño, en orden: copia de seguridad → `db push` → `functions deploy delete-account` → comprobación → `npm run rls` **solo** si hay copia reciente y sin escrituras en paralelo.
**Hecho cuando:** informe en `docs/vertice/seguridad.md` con lo comprobado y lo no comprobado.

### D-8 · Calidad de código y rendimiento (si queda tiempo)
- Código muerto: mocks que ya no se usen en producción, dependencias sin usar (`npx depcheck`), exportaciones sin referencias; elimina con prueba.
- Rendimiento web: tamaño del bundle de `build:web`, imágenes de póster con `expo-image` y caché, listas largas con `FlashList` (comprueba el historial de 5.000 entradas), memoización de los estilos con `useThemedStyles`.
- Cobertura: lista los módulos de `src/` sin ninguna prueba y escribe las que falten en los más críticos (`src/store/*`, `src/services/*`, `src/features/*`).
- `tsc --noEmit` y ESLint sin avisos; `npm audit --omit=dev` revisado (anota lo que no puedas arreglar).

---

## 3 · Informe final (al terminar o al agotar el tiempo)
`docs/vertice/noche/INFORME.md` debe contener: tabla de tareas con estado; líneas finales **tal cual** de `npm run verify`, `node scripts/auditoria-estilos.mjs`, `npm run build:web`, `npm run scan:secrets` y `npm run e2e`; commits de la rama `vertice/noche`; **qué no se pudo comprobar** (integración real con Supabase, iPhone, producción) y por qué; y los **pasos pendientes del dueño con comandos exactos**, en orden. No incluyas nada que no hayas ejecutado.
