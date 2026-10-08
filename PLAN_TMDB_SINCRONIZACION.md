# Plan de Sincronización TMDB - Diana Movie

## Objetivo
Implementar la descarga de datos desde TMDB para reemplazar el catálogo mock y verificar que funciona correctamente en producción.

## Arquitectura Actual

```
Cliente (Expo App)
    ↓
Edge Function `tmdb` (Supabase)
    ↓
API TMDB (themoviedb.org)
```

### Componentes Clave
- `src/services/tmdb/invoke.ts`: Invoca la Edge Function
- `src/services/tmdb/catalog.repository.ts`: Catálogo TMDB con caché local
- `src/services/tmdb/search.repository.ts`: Búsqueda con TMDB
- `src/lib/genreIndex.ts`: Registro de géneros para el motor de gustos

## Pasos de Implementación

### 1. Verificar Edge Function TMDB
- [ ] Confirmar que `supabase/functions/tmdb/index.ts` está desplegado
- [ ] Verificar que el secreto `TMDB_READ_TOKEN` está configurado
- [ ] Test manual: `curl https://hvjmewokgxgrshtzhdjq.functions.supabase.co/tmdb` con body `{action: "pool"}`

### 2. Probar en Desarrollo Local
```bash
# Configurar .env.local con CATALOG=tmdb
npx expo start --web --port 8089 --clear
```

- [ ] Login con Google
- [ ] Verificar que el feed muestra películas con pósters reales de TMDB
- [ ] Buscar una película en "Diario rápido"
- [ ] Verificar que la Ficha muestra info real (géneros, temporadas para series)

### 3. Verificar Variables GitHub Actions
En https://github.com/marcosariasglez/diana/settings/variables/actions:
- [ ] `CATALOG` = `tmdb`
- [ ] `BACKEND` = `supabase`
- [ ] `SUPABASE_URL` configurada
- [ ] `SUPABASE_ANON_KEY` configurada

### 4. Probar en Producción
- [ ] Esperar a que el workflow `deploy` termine
- [ ] Abrir https://marcosariasglez.github.io/diana/
- [ ] Login con Google
- [ ] Verificar películas con pósters TMDB
- [ ] Probar búsqueda

## Estrategia de Caché Implementada

```typescript
// Pool de películas (se carga UNA vez por sesión)
let poolPromise: Promise<Media[]> | null = null;
export function getPool(): Promise<Media[]> {
  if (!poolPromise) {
    poolPromise = invokeTmdb<Media[]>({ action: 'pool' });
  }
  return poolPromise;
}

// Caché de película individual
const mediaCache = new Map<string, Media>();
async getMediaById(type, id) {
  const k = `${type}:${id}`;
  const hit = mediaCache.get(k);
  if (hit) return hit;
  // ... fetch y cache
}

// Caché de temporada
const seasonCache = new Map<string, TVSeason>();
```

## Endpoints de la Edge Function TMDB

| Action | Descripción | Parámetros |
|--------|-------------|------------|
| `pool` | Pool de películas para el feed | Ninguno |
| `media` | Info de una película/serie | `type`, `id` |
| `season` | Info de una temporada | `id`, `season` |
| `search` | Buscar por título | `query`, `kind`, `page` |
| `match` | Match contra Letterboxd | `items` array |
| `providers` | Plataformas disponibles | Ninguno |

## Troubleshooting

### Si no aparecen pósters
1. Verificar que `mediaHelpers.ts` usa URL correcta: `https://image.tmdb.org/t/p/w500<path>`
2. Confirmar que la Edge Function devuelve `poster_path`

### Si la búsqueda no funciona
1. Verificar que `search.repository.ts` mapea correctamente los resultados
2. Confirmar que `invokeTmdb` no da error 401/403

### Si el feed está vacío
1. La Edge Function `pool` necesita devolver ~150 títulos
2. Verificar logs en Supabase Functions

## Siguientes Pasos

1. [ ] Deploy a producción con CATALOG=tmdb
2. [ ] Verificar en web
3. [ ] Verificar en iPhone (PWA)
4. [ ] Ajustar si hay errores
5. [ ] Implementar B6/B7 una vez TMDB esté funcionando
