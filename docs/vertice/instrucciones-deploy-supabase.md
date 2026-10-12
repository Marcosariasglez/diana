# Instrucciones para usar CATALOG=tmdb en GitHub Pages

## Problema actual
El workflow `deploy.yml` usa `CATALOG=mock` por defecto:
```yaml
EXPO_PUBLIC_CATALOG: ${{ vars.CATALOG || 'mock' }}
```

## Solución: Configurar variables en GitHub

### Paso 1: Ir a Settings → Secrets and variables → Actions → Variables

URL: https://github.com/Marcosariasglez/diana/settings/variables/actions

### Paso 2: Añadir estas variables

| Variable | Valor |
|----------|-------|
| `CATALOG` | `tmdb` |
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` |
| `SUPABASE_ANON_KEY` | `tu-anon-key-aqui` |

### Paso 3: Ejecutar el workflow manualmente

1. Ir a https://github.com/Marcosariasglez/diana/actions/workflows/deploy.yml
2. Pulsar "Run workflow"
3. Seleccionar la rama `main`
4. Pulsar "Run workflow"

## Opcional: Cambiar el default a tmdb

Si quieres que el deploy use `tmdb` por defecto incluso si no están configuradas las variables, cambia en `.github/workflows/deploy.yml`:

```yaml
EXPO_PUBLIC_CATALOG: ${{ vars.CATALOG || 'tmdb' }}
```

Pero esto requiere que tengas las variables de Supabase configuradas.

## Variables de entorno disponibles

| Variable | Descripción | Default |
|----------|-------------|---------|
| `CATALOG` | `mock` o `tmdb` | `mock` |
| `SUPABASE_URL` | URL del proyecto de Supabase | - |
| `SUPABASE_ANON_KEY` | Key anon de Supabase | - |
| `BACKEND` | `supabase` o `mock` | `supabase` |
| `RECOMMENDER` | `content` o `heuristic` | `heuristic` |

## Comprobar que funciona

Tras el deploy, abre tu web de GitHub Pages:
- Si ves "Película 658..." → sigue usando mock
- Si ves títulos reales → usa Supabase correctamente
