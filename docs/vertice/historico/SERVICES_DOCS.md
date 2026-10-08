# Diana Movie - Documentación de Servicios y Credenciales

> **Documento histórico** (movido de la raíz el 2026-10-08, turno nocturno VERTICE).
> El estado actual está en `docs/vertice/ESTADO.md`. **Purga de datos sensibles
> (2026-10-08):** se eliminaron dos correos personales de las tablas de
> Supabase y GitHub (el repo es público en GitHub; ver informe en
> `docs/vertice/noche/INFORME.md`). No contiene claves.

## 🔐 Credenciales y Acceso

### Supabase
| Item | Valor |
|------|-------|
| **Dashboard** | https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq |
| **Project ID** | `hvjmewokgxgrshtzhdjq` |
| **URL** | `https://hvjmewokgxgrshtzhdjq.supabase.co` |
| **Region** | West EU (Ireland) |
| **Plan** | Free |
| **Email** | [PURGADO en el turno nocturno 2026-10-08: dato personal, no se versiona] |
| **Anon Key** | Guardada en `.env.local` y GitHub Variables |
| **Service Role** | Solo en `.env.local` (NO subirla a GitHub) |

### Google Cloud (OAuth)
| Item | Valor |
|------|-------|
| **Project Name** | Diana |
| **Project ID** | (Ver en Google Cloud Console) |
| **OAuth Client ID** | Configurado en Google Cloud |
| **Tipo** | Desktop Application (para login local) |
| **Authorized Origins** | `https://hvjmewokgxgrshtzhdjq.supabase.co` |
| **Redirect URIs** | `https://hvjmewokgxgrshtzhdjq.supabase.co/auth/v1/callback` |
| **Dashboard** | https://console.cloud.google.com |

### GitHub
| Item | Valor |
|------|-------|
| **Username** | `marcosariasglez` |
| **Repo** | https://github.com/marcosariasglez/diana |
| **Pages URL** | https://marcosariasglez.github.io/diana/ |
| **Branch** | `main` |
| **GitHub Email** | [PURGADO en el turno nocturno 2026-10-08: dato personal, no se versiona] |

### Variables de GitHub Actions
Estas variables están configuradas en: https://github.com/marcosariasglez/diana/settings/variables/actions

| Name | Value |
|------|-------|
| `BACKEND` | `supabase` |
| `CATALOG` | `mock` |
| `SUPABASE_URL` | `https://hvjmewokgxgrshtzhdjq.supabase.co` |
| `SUPABASE_ANON_KEY` | (Configurada) |

## 📁 Estructura del Proyecto

```
diana-tmp/
├── app/                    # Pantallas y rutas
├── src/
│   ├── lib/                # Librerías (env, supabase)
│   ├── store/              # Zustand stores
│   ├── services/           # Repositorios de datos
│   ├── components/         # UI components
│   ├── features/           # Lógica por feature
│   ├── mocks/              # Datos mock y AI
│   ├── types/              # TypeScript types
│   └── theme/              # Colores, tipografía
├── supabase/
│   ├── migrations/         # 4 archivos SQL
│   └── functions/          # Edge Functions (TMDB, delete-account)
├── scripts/                # Scripts de build
└── public/                 # Assets estáticos (iconos)
```

## 🔗 URLs Importantes

### Supabase
- Dashboard: https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq
- SQL Editor: https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq/sql
- Auth URL Config: https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq/auth/url
- SMTP Settings: https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq/auth/smtp
- Table Editor: https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq/editor

### Google Cloud
- Console: https://console.cloud.google.com
- OAuth Credentials: https://console.cloud.google.com/apis/credentials
- OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent

### GitHub
- Repo: https://github.com/marcosariasglez/diana
- Actions: https://github.com/marcosariasglez/diana/actions
- Pages Settings: https://github.com/marcosariasglez/diana/settings/pages
- Variables: https://github.com/marcosariasglez/diana/settings/variables/actions

## 🗄️ Tablas Supabase

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil de usuario (nombre, plataformas, géneros) |
| `initial_ratings` | Valoraciones del onboarding (like/skip/unseen) |
| `history_entries` | Historial completo de valoraciones |
| `watched` | Películas marcadas como vistas |
| `rooms` | Salas de juego (código, fase, mood, deck) |
| `room_members` | Miembros de cada sala |
| `room_decisions` | Decisiones (like/skip) de cada miembro |
| `tmdb_cache` | Caché de respuestas de TMDB |
| `api_hits` | Contador de peticiones por minuto |

## 🔐 Políticas RLS (Row Level Security)

- `profiles_own`: Solo el usuario ve su perfil
- `initial_ratings_own`: Solo el usuario ve sus valoraciones
- `history_entries_own`: Solo el usuario ve su historial
- `watched_own`: Solo el usuario ve sus vistas
- `rooms_member_read`: Solo miembros de la sala ven la sala
- `room_members_member_read`: Solo miembros ven otros miembros
- `room_decisions_member_read`: Solo miembros ven decisiones

## 📝 Funciones RPC

| Función | Descripción |
|---------|-------------|
| `create_room(p_name)` | Crea sala y devuelve código |
| `join_room(p_code, p_name)` | Une usuario a sala |
| `set_ready(p_code, p_ready)` | Marca listo/no listo |
| `leave_room(p_code)` | Sale de la sala |
| `start_match(p_code)` | Inicia match (solo host) |
| `set_mood_answer(p_code, p_question, p_answer)` | Responde mood (solo host) |
| `confirm_mood(p_code, p_deck)` | Confirma mood y fija deck (solo host) |
| `submit_decision(p_code, p_key, p_decision)` | Envía decisión like/skip |
| `back_to_lobby(p_code)` | Vuelve a lobby (solo host) |
| `group_seen_keys(p_code)` | Devuelve claves vistas del grupo |
| `bump_api_hits(p_user)` | Incrementa contador de peticiones |

## 🚀 Deploy Workflow

El archivo `.github/workflows/deploy.yml` ejecuta:
1. Checkout del código
2. `npm ci` (instalar dependencias)
3. `npm run verify` (typecheck + lint + test)
4. `npm run build:web` (genera PWA)
5. Copia `dist/index.html` a `dist/404.html` (SPA fallback)
6. Sube a GitHub Pages

## 🔧 Comandos Útiles

```bash
# Desarrollo local
npx expo start --web --port 8089 --clear

# Build para producción
npm run build:web

# Tests
npm run verify    # typecheck + lint + test
npm run test      # solo tests
npm run typecheck # solo tipos

# Scripts de Supabase
npx supabase login
npx supabase init
npx supabase link --project-ref hvjmewokgxgrshtzhdjq
npx supabase db push
```

## 📱 PWA en iPhone

1. Abrir URL en Safari
2. Compartir → "Añadir a pantalla de inicio"
3. La sesión se guarda en AsyncStorage (localStorage en web)
4. Al volver a abrir, el usuario ya está logueado

## 🔒 Seguridad

- `.env.local` está en `.gitignore`
- `SUPABASE_SERVICE_ROLE_KEY` solo en local
- `SUPABASE_ANON_KEY` es pública pero con RLS activado
- Google OAuth con PKCE flow
- Todas las escrituras de salas van por RPC (RLS deniega insert directo)

## 📊 Estado Actual

- ✅ B0: PWA local (61 tests)
- ✅ B1: GitHub Pages
- ✅ B2: Login Google
- ✅ B3: Supabase + datos
- ✅ B4: Salas en tiempo real
- ⏳ B5: TMDB (pendiente API key)
- ⏳ B6: Exportar/borrar datos
- ⏳ B7: Letterboxd import

## 🆘 Soporte

- **Problemas de login en iPhone**: Verificar URLs de redirect en Supabase
- **404 en rutas profundas**: Verificar `404.html` en deploy
- **RLS deniega acceso**: Verificar políticas en SQL Editor
- **Tests fallan**: Ejecutar `npm run test -- --verbose`
