> ⚠️ **OBSOLETO (VERTICE).** Este documento se congeló antes del plan VERTICE (61 tests, fases B0–B5).
> **Fuente de verdad del estado: [`docs/vertice/ESTADO.md`](docs/vertice/ESTADO.md).**
> Se conserva como registro histórico. Lo de B6 (exportar y borrar cuenta) se cumplió en VERTICE D3/D5.

# Diana Movie - Estado de Implementación

## ✅ COMPLETADO

### B0 - PWA Local
- [x] 61 tests passing
- [x] Build web funcionando
- [x] Iconos PWA generados

### B1 - GitHub Pages
- [x] Repositorio: https://github.com/marcosariasglez/diana
- [x] Deploy automático con workflow
- [x] URL: https://marcosariasglez.github.io/diana/

### B2 - Login con Google
- [x] Google OAuth configurado
- [x] Login en localhost:8089 funcionando
- [x] Login en GitHub Pages funcionando
- [x] PWA en iPhone con sesión persistente

### B3 - Supabase (Datos Usuario)
- [x] 4 migraciones SQL ejecutadas:
  - 0001_schema.sql
  - 0002_rls.sql
  - 0003_rpc.sql
  - 0004_realtime.sql
- [x] Row Level Security configurado
- [x] Datos aislados por usuario
- [x] Bootstrap de datos al login

### B4 - Salas en Tiempo Real
- [x] Repositorios implementados
- [x] Tests pasando
- [x] Realtime configurado

### B5 - TMDB (Catálogo Real)
- [x] Edge Function `tmdb` desplegada en Supabase
- [x] API key TMDB configurada
- [x] Repositorios TMDB creados:
  - src/services/tmdb/catalog.repository.ts
  - src/services/tmdb/search.repository.ts
  - src/services/tmdb/invoke.ts
  - src/services/tmdb/import.repository.ts
- [x] genreIndex.ts implementado
- [x] catalog.select.ts con switch mock/tmdb
- [x] services/index.ts con lazy loading
- [x] Variables GitHub Actions configuradas:
  - BACKEND: supabase
  - CATALOG: tmdb

## 🔧 EN PROGRESO (al congelarse)

- [x] B6 - Exportar datos y borrar cuenta → **VERTICE D3** (exportMyData + delete-account)
- [x] B7 - Letterboxd import

## 📚 Documentación

- [x] SERVICES_DOCS.md - Servicios y credenciales (uso propio, repo privado)
- [x] BACKEND_PROGRESS.md - Progreso por fases (obsoleto)
- [x] PROGRESS.md - Resumen rápido (obsoleto)
- [x] IMPLEMENTATION_STATUS.md - Este archivo
- [x] docs/vertice/ESTADO.md - **Estado real (VERTICE)**

## 🔑 Credenciales

> Solo para uso propio del dueño (repo privado). Nunca se imprimen en el repo ni en logs.

### Supabase
- Dashboard: https://supabase.com/dashboard/project/hvjmewokgxgrshtzhdjq
- Project ID: hvjmewokgxgrshtzhdjq
- Region: West EU (Ireland)

### GitHub
- Repo: https://github.com/marcosariasglez/diana
- Pages: https://marcosariasglez.github.io/diana/
- Actions: https://github.com/marcosariasglez/diana/actions

### Google Cloud
- OAuth configurado
- Redirect URI: https://hvjmewokgxgrshtzhdjq.supabase.co/auth/v1/callback
