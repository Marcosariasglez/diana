# Diana

App de cine (PWA móvil): descubrimiento personalizado con IA de predicción de gustos, mood
wizard, salas de amigos en tiempo real e importación Letterboxd.

- **Stack:** Expo SDK 57 / React Native + expo-router + NativeWind + Zustand + Supabase
- **Backend:** Supabase (Auth + Postgres + Realtime + Edge Functions `tmdb` y `delete-account`)
- **Diseño:** sistema visual VERTICE (idéntico a Norte) — ver [`VERTICE-README.md`](VERTICE-README.md)
- **Estado real del proyecto:** [`docs/vertice/ESTADO.md`](docs/vertice/ESTADO.md)
- **Paridad con Norte:** [`docs/vertice/paridad.md`](docs/vertice/paridad.md)
- **Seguridad (RLS, service_role, keepalive):** [`docs/vertice/seguridad.md`](docs/vertice/seguridad.md)

> Fuente única de verdad del estado: [`docs/vertice/ESTADO.md`](docs/vertice/ESTADO.md)
> (incluye el registro histórico de las fases B0–B7; los antiguos `PROGRESS.md`,
> `BACKEND_PROGRESS.md` e `IMPLEMENTATION_STATUS.md` se eliminaron el 2026-10-08).

## Arranque local

```bash
npm ci
# crea .env.local (ignorado por git) con:
#   EXPO_PUBLIC_BACKEND=mock            # mock | supabase
#   EXPO_PUBLIC_CATALOG=mock            # mock | tmdb (exige BACKEND=supabase)
#   EXPO_PUBLIC_BASE_URL=               # p. ej. /diana en GitHub Pages
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...       # SOLO local / servidor; jamás en el repo
npm start                 # desarrollo
npm run build:web         # export web → dist/
```

Modos: con `BACKEND=mock` la app no pide inicio de sesión y todo es local; con
`BACKEND=supabase` hay puerta de acceso (Google PKCE o código por correo).

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run verify` | typecheck + lint (0 warnings) + tests |
| `npm run build:web` | `expo export --platform web` + postbuild PWA |
| `npm run rls` | Prueba de aislamiento RLS con usuarios reales (lee `.env.local`) |
| `npm run scan:secrets` | Comprobar que `service_role` no filtra en `app/ src/ public/ dist/` |
| `npm run icons` | Regenerar iconos PWA |
| `node scripts/auditoria-estilos.mjs` | Auditoría de estilo X6 (sin hex sueltos, radios, pesos) |
| `node scripts/capturas.mjs [--despues]` | Capturas 390×844 claro/oscuro (Playwright + `dist` servido) |

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `EXPO_PUBLIC_BACKEND` | `mock` \| `supabase` |
| `EXPO_PUBLIC_CATALOG` | `mock` \| `tmdb` |
| `EXPO_PUBLIC_BASE_URL` | Prefijo de despliegue (p. ej. `/diana`) |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cliente (público) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo** `.env.local` local / secretos de Edge Functions. Nunca en el repo ni en el front |

`.env.local` está ignorado por git. La `service_role` vive únicamente en el servidor
(Edge Functions) y en el `.env.local` del dueño; `npm run scan:secrets` lo vigila.

## Estructura

- `app/` — rutas (expo-router): `(tabs)` Inicio/Mood/Match/Perfil, `login`, `account`, `mood-wizard`, `mood-results`, `daily-log`, `notifications`, `see-all`, `room/*`, `(onboarding)`
- `src/theme/` — tokens VERTICE (`tokens.ts`), `ThemeProvider`/`useTheme`, tipografía X3, sombras, `alpha.ts`
- `src/components/ui/` — componentes del contrato A3.4 (Button, Card, BottomNav, FabButton, SegmentedControl, ListRow, ProfileCard, TextField, ConfirmSheet, GoogleButton, …)
- `src/components/features/` — componentes de cine (Poster, SwipeDeck, SlotReveal, …)
- `src/store/` — Zustand (auth, perfil, historial, mood, salas, ajustes)
- `src/services/` — repositorios mock/Supabase + export
- `supabase/` — migraciones `0001`–`0005` y Edge Functions `tmdb`, `delete-account`

## Deploy

GitHub Pages en `/diana` (`.github/workflows/deploy.yml`: verify + build + 404 fallback).
Keepalive de Supabase cada 3 días (`.github/workflows/keepalive.yml`, consulta anon a Postgres).

### Pendientes del dueño (el agente no toca producción)

1. `npx supabase db push` — aplica la migración `0005_delete_user_data.sql` (copia de seguridad previa)
2. `npx supabase functions deploy delete-account --project-ref hvjmewokgxgrshtzhdjq` (primero en proyecto de pruebas)
3. Re-ejecutar `npm run rls` en producción
4. Supabase → Authentication: Redirect URLs reales + plantillas «Magic Link» y «Confirm signup» con `{{ .Token }}` + SMTP propio (Resend/Brevo)
5. Prueba real del guion D5 (PC, iPhone, PWA instalada)
