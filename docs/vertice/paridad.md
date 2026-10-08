# Paridad Diana ↔ Norte (A8)

> Fecha: 2026-10-08 · Estado: **D0–D6 completadas** (falta lo que exige producción, marcado con ⚠️).
>
> **Método de comprobación (X6):** capturas de Diana en 390×844 (claro y oscuro) en [`capturas/despues/`](./capturas/despues/)
> frente a las referencias de [`referencia/movil-claro/`](./referencia/movil-claro/) y [`referencia/movil-oscuro/`](./referencia/movil-oscuro/).
> Tolerancia: **0 px** en márgenes, radios y alturas de componentes; **±1 px** en posiciones de texto por renderizado.
> Soporte automático: `scripts/auditoria-estilos.mjs` (radios/padding/`fontWeight` sueltos) y ESLint anti-hex — ambos en 0 fallos.

Leyenda: ✓ cumplido y verificado · ⚠️ código listo y probado, pero requiere producción (ver [pendientes](#pendientes-del-dueño)) · n/a no aplica en mock.

## A8 · Criterios de paridad

### Visual

| Criterio | Estado | Evidencia |
|---|---|---|
| Mismos tokens (A3.1) en claro y oscuro; ningún color suelto en pantallas | ✓ | `src/theme/tokens.ts` única fuente; ESLint `no-restricted-syntax` anti-hex en `app/**` + `src/components/**` (excepciones documentadas); auditoría 0 |
| Manrope + Inter estáticas en ambas; cifras tabulares | ✓ | 7 TTF estáticos generados y validados ([`scripts/generate-fonts.py`](../../scripts/generate-fonts.py)): Manrope 600/700/800 + Inter 400/500/600/700; `fontVariant:['tabular-nums']` en `big`, `value`, `roomCode`, `predictionRevealed` (X3) y en códigos/notas (`login.tsx`, `HistoryRow`, `SlotReveal`, `MetricCard`) |
| Tarjetas radio 24, botón principal `ink` píldora, FAB 58 verde, barra 88 con desenfoque y pestaña activa en `ink` | ✓ | [`Card.tsx`](../../src/components/ui/Card.tsx) r24 · [`Button.tsx`](../../src/components/ui/Button.tsx) píldora `ink`/`onInk` · [`FabButton.tsx`](../../src/components/ui/FabButton.tsx) 58 `acc` sombra `0 8 20` 40 % · [`BottomNav.tsx`](../../src/components/ui/BottomNav.tsx) 88 + `card` 92 % + blur 16 (web) + activa `ink` |
| Apariencia Claro/Oscuro/Auto funcionando al instante y persistente | ✓ | `SegmentedControl` en [`profile.tsx`](../../app/(tabs)/profile.tsx) y [`account.tsx`](../../app/account.tsx) → `setAppearance` (Zustand persist); `ThemeProvider` re-tematiza al instante |
| Pantalla de acceso A4 completa | ✓ | [`login.tsx`](../../app/login.tsx): logo 56, Google, separador, correo, código 6 dígitos `one-time-code`, reenviar con cooldown 30 s, cambiar correo, errores literales A4, pie legal |
| Pantalla Cuenta A5 completa | ✓ | [`account.tsx`](../../app/account.tsx): Perfil, INFORMACIÓN, nombre editable, APARIENCIA, CUENTA (exportar/cerrar/cerrar todos/borrar con frase), acceso VERTICE global (Q2), pie legal + versión; mock muestra «Modo demostración» |
| Capturas lado a lado Login/Inicio/Más-Perfil/Cuenta (claro y oscuro) | ✓ | [`capturas/despues/`](./capturas/despues/): 12 PNG 390×844 (`login`, `inicio`, `mood`, `match`, `perfil`, `cuenta` × claro/oscuro) + `informe.json`; sin serif de fallback, fuentes verificadas |

### Cuenta

| Criterio | Estado | Evidencia |
|---|---|---|
| Entrar con Google y código por correo en las dos apps, también en la PWA de iPhone | ⚠️ | Implementado y probado con mocks ([`useAuthStore.test.ts`](../../src/store/useAuthStore.test.ts), [`login.test.tsx`](../../src/__tests__/login.test.tsx), 12 estados); requiere despliegue + prueba real (PWA en iPhone) por el dueño |
| Cerrar sesión / en todos / exportar / borrar funcionan **de verdad** (verificable en BD) | ⚠️ | Lógica lista y probada: `signOut` (`resetLocalStores`), `signOutEverywhere` (`scope:'global'`), [`export.ts`](../../src/services/export.ts) (JSON + `expo-sharing`), Edge Function [`delete-account`](../../supabase/functions/delete-account/index.ts) + RPC [`0005_delete_user_data.sql`](../../supabase/migrations/0005_delete_user_data.sql) (tests Deno: only-Diana vs `everywhere:true`, 401/405, CORS). Queda: `db push` 0005 + `functions deploy` + comprobación en BD por el dueño |
| Un usuario nunca ve datos de otro (Diana: `npm run rls`) | ⚠️ (producción) | [`rls-check.mjs`](../../scripts/rls-check.mjs) extendido: `initial_ratings`, `watched`, `profiles` (lectura/escritura cruzada bloqueada) + `delete_user_data` bloqueado **por permisos** (revoke; el error debe ser «permission denied»). El script apunta al proyecto de `.env.local` —hoy producción, **no existe proyecto de pruebas**— y crea/borra 3 usuarios temporales: es seguro ejecutarlo con 0005 desplegada y respaldo reciente (ver [seguridad.md](./seguridad.md)). Pendiente: re-ejecución en producción tras el `db push` (dueño) |
| Mismo texto en cada error de A4 | ✓ | [`authMessages.ts`](../../src/constants/authMessages.ts) literales A4; mapeo de códigos en [`useAuthStore.ts`](../../src/store/useAuthStore.ts); test de cada estado en [`login.test.tsx`](../../src/__tests__/login.test.tsx) |

### Calidad

| Criterio | Estado | Evidencia |
|---|---|---|
| Batería de pruebas en verde (`npm run verify`) | ✓ | typecheck + lint + test (línea final en [ESTADO.md](./ESTADO.md) y en el informe de cierre de D6) |
| README del repo actualizado y sin info obsoleta | ✓ | [`README.md`](../../README.md) nuevo (portada, arranque, variables, comandos, enlaces a docs); docs de estado unificadas en [`ESTADO.md`](./ESTADO.md) (los tres históricos se eliminaron el 2026-10-08, absorbiendo lo útil sin credenciales) |

## X6 · Lista de comprobación por pantalla

Aplicada a las 6 pantallas capturadas. ✓ = cumplido en código (auditado) y verificado en captura.

| Punto | Login | Inicio | Mood | Match | Perfil | Cuenta |
|---|---|---|---|---|---|---|
| margen lateral 20 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cabecera 56 / título 28/800 (o variante A4/A5) | ✓ (hero 32/800 + logo 56, A4) | ✓ | ✓ | ✓ | ✓ | ✓ (16/700 centrado con «atrás», A5) |
| radios de la tabla X4 (24/20/22/16/13/32/99/50 %) | ✓ (inputs 16, botón 99) | ✓ (card 24, póster 20, chips 99) | ✓ | ✓ | ✓ | ✓ |
| separación entre tarjetas 14 | n/a (sin tarjetas apiladas) | ✓ | ✓ | ✓ | ✓ | ✓ |
| cabeceras de sección 19/800 con enlace `acc` | n/a | ✓ (Recomendaciones + «Ver todo» `acc`) | n/a | n/a | n/a | n/a (grupos `.gh` 12.5/700 mayúsculas) |
| filas 11/12/15/12.5 | n/a | n/a | n/a | n/a | ✓ (ListRow historial/ajustes) | ✓ (ListRow correo/exportar/cerrar/borrar) |
| familia y peso de cada texto (X3) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| colores solo de tokens | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| barra inferior X2 (88, blur, FAB 58) | n/a | ✓ | ✓ | ✓ | ✓ | n/a (pantalla secundaria) |
| oscuro sin sombras ni bordes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cifras tabulares | ✓ (código 6 dígitos) | ✓ (match 87 %) | ✓ | ✓ | ✓ (métricas 238/4.7) | n/a |

## X5 · Pantalla a pantalla (resumen de aplicación)

| Pantalla | Aplicado | Referencia |
|---|---|---|
| Inicio «Para ti» | Cabecera X1 + chips de filtro (activo `ink`) + tarjeta Recomendación Top (r24, insignia `accSoft`+`acc`, póster r20) + carril con sección 19/800 y «Ver todo» `acc` + título póster Manrope 13/700 gap 8 | `01-inicio.png`, `06-inversion-cartera.png` |
| Mood | Cabecera + opciones como tarjetas (selección `ink`/`onInk`) + barra 8 + botón principal fijo | `03-anadir-gasto.png` |
| Mood wizard | Pregunta `wizardQuestion` + fichas radio 24 + seleccionado `ink` | `03-anadir-gasto.png` |
| Resultados/Match | Filas con póster 42×62 (r13) + insignia de match | `02-movimientos.png` |
| Sala (lobby) | Código en tarjeta pad24 `roomCode` + miembros en filas con avatar HSL 42 + estado `cchip` | `05-detalle-cuenta.png` |
| Swipe | Carta r24 + botones circulares 54 (`.qb`) + contador `bodySmall` | `01-inicio.png` |
| Ficha | Póster grande r24 + `detailTitle` + metadatos en insignias + mini-tarjetas `.mini` + segmentos de episodio | `05-detalle-cuenta.png` |
| Diario rápido (botón +) | Hoja X2 con buscador + filas + estrellas + botón principal | `03-anadir-gasto.png` |
| Perfil | ProfileCard (`.prof`) + 2 mini-tarjetas (gap 10) + importar (pad24) + historial (filas) + filas de ajuste | `09-mas-ajustes.png` |
| Cuenta | Como «Más» de Norte (A5) | `09-mas-ajustes.png` |
| Bienvenida | Logotipo 56 + `heroTitle` + botón principal abajo margen 20, sin colores sueltos | A4 |
| Estados vacío/error/cargando | `EmptyState`/`ErrorState` círculo 56 `chip`, 17/800; `Skeleton` con la forma real | `07-inversion-programadas.png` |

## Pendientes del dueño

Todo lo marcado ⚠️ requiere producción (sin tocar nada desde el repo, por regla del plan):

1. **Migración 0005** (RPC `delete_user_data`): backup y luego
   `npx supabase db push --project-ref hvjmewokgxgrshtzhdjq`
2. **Edge Function delete-account** (reescrita, Q2): `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq`
   y `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... --project-ref hvjmewokgxgrshtzhdjq` (si no está).
   No existe proyecto de pruebas: se despliega en este proyecto, tras el paso 1.
3. **`npm run rls` en producción** tras el `db push` (revalidar RLS real; crea y borra 3
   usuarios temporales — ver [seguridad.md](./seguridad.md) para cuándo es seguro ejecutarlo).
4. **Supabase Auth**: Redirect URLs de producción, plantillas «Magic Link»/«Confirm signup» con `{{ .Token }}` y SMTP propio.
5. **Prueba real en iPhone/PWA**: Google + código por correo, cerrar en todos, exportar y borrar (verificar después en la BD).
