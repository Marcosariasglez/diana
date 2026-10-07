# Diana Movie - Documentación del Proyecto

## Estado Actual: COMPLETADO (Fases B0-B4.6 + Google OAuth)

### 1. Backend con Supabase ✅
- **Proyecto creado**: `hvjmewokgxgrshtzhdjq` (West EU - Ireland)
- **4 Migraciones SQL ejecutadas**:
  - `0001_schema.sql`: 9 tablas + trigger automático de perfiles
  - `0002_rls.sql`: Políticas de seguridad por filas (RLS)
  - `0003_rpc.sql`: 13 funciones RPC para salas en tiempo real
  - `0004_realtime.sql`: Publicaciones realtime para salas
- **Configuración `.env.local`**: Credenciales de Supabase configuradas
- **Google OAuth**: Login funcionando con cuenta Google

### 2. Autenticación ✅
- **Pantalla de login** (`app/login.tsx`): Google + Email OTP
- **Auth Store** (`src/store/useAuthStore.ts`): Gestión de sesión
- **Perfil automático**: Se crea al registrarse
- **Datos aislados**: Cada usuario ve solo sus datos (RLS)

### 3. Datos de Usuario ✅
- **Perfil**: Nombre, plataformas favoritas, géneros, onboarding
- **Historial**: Valoraciones, predicciones IA, películas vistas
- **Sincronización**: Escritura automática al servidor con `reportSyncError`
- **Bootstrap**: Al iniciar sesión, carga datos del servidor

### 4. Salas en Tiempo Real ✅
- **Repositorio Supabase** (`src/services/supabase/room.repository.ts`): Operaciones de salas
- **UseRoomStore**: Estado de salas, deck, decisiones
- **UseGroupSwipe**: Swipe grupal con deck compartido
- **Test**: `room.repository.test.ts` pasando

### 5. PWA y Build ✅
- **Build web**: Script `build:web` con `output: 'single'`
- **Iconos**: Generados para PWA (192px, 512px, apple-touch)
- **Tests**: 61 suites pasando

---

## Pendiente de Implementar

### B5 - TMDB (Catálogo Real)
- Necesita API key de TMDB
- Edge Function para proxy de TMDB
- Repositorios de catálogo y búsqueda con TMDB

### B6 - Endurecimiento
- Exportar datos del usuario
- Borrar cuenta
- Política de privacidad
- Pantalla "Acerca de"

### B7 - Letterboxd
- Importación de ratings.csv de Letterboxd
- Match contra TMDB

### B1 - Despliegue en GitHub Pages
- Configurar GitHub Actions
- Variables de entorno en GitHub
- Dominio personalizado (opcional)

### Vista Móvil
- Modificar CSS para aspect ratio móvil
- Simulador de móvil en desarrollo
- Viewport optimizado

---

## Credenciales

| Servicio | Valor |
|----------|-------|
| Supabase URL | `https://hvjmewokgxgrshtzhdjq.supabase.co` |
| Anon Key | Configurada en `.env.local` |
| Service Role | Configurada en `.env.local` |
| Google OAuth | Client ID/Secret en Supabase |

---

## Archivos Clave

### Autenticación
- `app/login.tsx` - Pantalla de login
- `src/store/useAuthStore.ts` - Estado de auth
- `src/lib/supabase.ts` - Cliente Supabase
- `src/lib/env.ts` - Variables de entorno

### Datos
- `src/store/useProfileStore.ts` - Perfil usuario
- `src/store/useHistoryStore.ts` - Historial valoraciones
- `src/store/bootstrapUserData.ts` - Carga datos al iniciar sesión
- `src/services/profile.repository.ts` - Interfaz + mock
- `src/services/supabase/profile.repository.ts` - Implementación Supabase

### Salas
- `src/store/useRoomStore.ts` - Estado de salas
- `src/features/room/useGroupSwipe.ts` - Swipe grupal
- `src/services/room.repository.ts` - Interfaz + mock
- `src/services/supabase/room.repository.ts` - Implementación Supabase

### Infraestructura
- `supabase/migrations/0001-0004*.sql` - Esquema base
- `src/services/index.ts` - Repositorios con lazy loading
- `scripts/postbuild-pwa.mjs` - Build PWA
- `scripts/make-icons.mjs` - Generador iconos

---

## Próximos Pasos

1. **Vista Móvil**: Modificar CSS para simulador de móvil
2. **Deploy GitHub Pages**: Configurar CI/CD
3. **TMDB** (opcional): Catálogo real de películas
4. **B6/B7** (opcional): Exportar datos, Letterboxd
