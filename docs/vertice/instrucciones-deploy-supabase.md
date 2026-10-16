# Guía completa: Configurar catálogo TMDB en Supabase para producción

> **Actualización 2026-10-13:** el diagnóstico de abajo era incompleto. La mayoría
> de las filas sin título eran **series guardadas como películas** (bug de
> `catalog-sync`, ya corregido). La Opción B de esta guía (backfill) les ponía el
> título de otra película. Sigue [reparar-catalogo-series.md](reparar-catalogo-series.md).

## Diagnóstico

Si ves títulos como "Película 658..." o "[Título no disponible]" en tu app, significa que la tabla `catalog_titles` de Supabase tiene filas con `title = NULL`. Esto ocurre cuando la sincronización inicial (catalog-sync) escribió "stubs" sin llamar al detalle de TMDB.

---

## PASO 1: Verificar el estado actual de los datos

### 1.1 Abre el SQL Editor de Supabase

1. Ve a https://supabase.com/dashboard/project/**TU_PROYECTO**
2. En el menú lateral izquierdo, haz clic en **SQL Editor**
3. Haz clic en **New query** (arriba a la derecha)

### 1.2 Ejecuta esta consulta para ver cuántos títulos faltan

```sql
-- Cuántas filas tienen title vacío o NULL
SELECT 
  COUNT(*) FILTER (WHERE title IS NULL OR title = '') AS sin_titulo,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE title IS NULL OR title = '') / NULLIF(COUNT(*), 0), 1) AS pct_sin_titulo
FROM catalog_titles;
```

Si `sin_titulo > 0`, pasa al Paso 2.

### 1.3 Ejemplo de filas problemáticas

```sql
-- Mira algunos ejemplos
SELECT tmdb_id, media_type, title, original_title, year 
FROM catalog_titles 
WHERE title IS NULL OR title = '' 
LIMIT 10;
```

---

## PASO 2: Rellenar los títulos vacíos (2 opciones)

### Opción A: Query SQL rápido (si `original_title` ya tiene datos)

Si la columna `original_title` ya tiene valores, simplemente cópialos a `title`:

```sql
-- Rellena title desde original_title donde esté vacío
UPDATE catalog_titles 
SET title = original_title 
WHERE (title IS NULL OR title = '') 
  AND original_title IS NOT NULL 
  AND original_title != '';
```

**Verifica el resultado:**
```sql
SELECT COUNT(*) AS todavia_vacios FROM catalog_titles WHERE title IS NULL OR title = '';
```

Si quedan filas vacías después de esto, también ejecuta la Opción B.

### Opción B: Ejecutar el Edge Function `catalog-backfill`

Esta función llama a la API de TMDB por cada título vacío y rellena `title`, `original_title`, `year` y `overview`.

#### B.1 Prerequisitos

Asegúrate de que estos secretos existen en Supabase:

1. Ve a **Settings → API** en tu proyecto de Supabase
2. Copia el valor de **project URL** (ej: `https://abcdefghijklmnop.supabase.co`)
3. Copia el valor de **service_role key** (NO la anon key)
4. Ve a **Settings → Edge Functions** → **Manage secrets**
5. Verifica que existen:
   - `SUPABASE_URL` = tu project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = tu service_role key
   - `TMDB_READ_TOKEN` = tu token de lectura de TMDB (obténlo en https://www.themoviedb.org/settings/api)
   - `CATALOG_SYNC_SECRET` = cualquier string aleatorio (ej: `mi-secreto-sinc-12345`)

#### B.2 Desplegar la función (si no está ya)

```bash
cd diana-tmp
npx supabase functions deploy catalog-backfill --project-ref hvjmewokgxgrshtzhdjq
```

#### B.3 Ejecutar la función manualmente

Puedes ejecutarla desde el dashboard de Supabase:

1. Ve a **Functions → catalog-backfill → Invoke**
2. En el cuerpo de la request (JSON):
```json
{}
```
3. En los **Headers**, añade:
```
x-catalog-sync-secret: tu-secreto-aqui
```
4. Haz clic en **Invoke**

La función devolverá algo como:
```json
{
  "processed": 60,
  "remaining": 4500,
  "elapsedMs": 118000
}
```

Si `remaining > 0`, repite la invocación hasta que `remaining: 0`.

#### B.4 O ejecutarla desde GitHub Actions

Si tienes el workflow `catalog-backfill.yml` configurado:

1. Ve a https://github.com/Marcosariasglez/diana/actions/workflows/catalog-backfill.yml
2. Haz clic en **Run workflow** (derecha)
3. Selecciona la rama **main**
4. Haz clic en **Run workflow**

El workflow repetirá automáticamente hasta que todos los títulos estén rellenados.

---

## PASO 3: Verificar que todo está correcto

### 3.1 Verifica en Supabase

```sql
-- Debería dar 0
SELECT COUNT(*) AS vacios FROM catalog_titles WHERE title IS NULL OR title = '';

-- Muestra algunos resultados
SELECT tmdb_id, media_type, title, year FROM catalog_titles ORDER BY popularity DESC LIMIT 10;
```

### 3.2 Verifica en la app

1. Asegúrate de que en **GitHub Settings → Secrets and variables → Actions → Variables** tienes:
   - `CATALOG` = `tmdb`
   - `SUPABASE_URL` = `https://tu-proyecto.supabase.co`
   - `SUPABASE_ANON_KEY` = tu anon key (no la service_role)

2. Fuerza un nuevo deploy:
   - Ve a https://github.com/Marcosariasglez/diana/actions/workflows/deploy.yml
   - Haz clic en **Run workflow** → **Run workflow**

3. Abre tu GitHub Pages y verifica que los títulos son reales.

---

## PASO 4: Mantener el catálogo actualizado

### Sincronización semanal automática

El workflow `catalog-sync.yml` ejecuta un barrido completo semanalmente. Verifica que existe:

1. Ve a https://github.com/Marcosariasglez/diana/actions/workflows/catalog-sync.yml
2. Debería tener un schedule tipo:
```yaml
schedule:
  - cron: '0 4 * * 0'  # Domingo a las 4:00 UTC
```

### Backfill periódico

Ejecuta `catalog-backfill` periódicamente (semanal o mensual) para rellenar cualquier título nuevo que llegue vacío.

---

## RESUMEN RÁPIDO

| Qué | Dónde | Cómo |
|-----|-------|------|
| **Verificar títulos vacíos** | Supabase Dashboard → SQL Editor | `SELECT COUNT(*) FROM catalog_titles WHERE title IS NULL;` |
| **Rellenar rápido** | Supabase Dashboard → SQL Editor | `UPDATE catalog_titles SET title = original_title WHERE title IS NULL;` |
| **Rellenar con TMDB** | Supabase → Functions → catalog-backfill → Invoke | Invocar con header `x-catalog-sync-secret` |
| **Configurar vars GitHub** | GitHub → Settings → Secrets and variables → Actions | Añadir `CATALOG=tmdb`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **Forzar deploy** | GitHub → Actions → deploy.yml → Run workflow | Ejecutar manualmente |

---

## SOLUCIÓN DE PROBLEMAS

### "Este título no existe" / "No se ha podido cargar la ficha"

- **Causa**: El ID del título no existe en `catalog_titles` o la ficha no se carga.
- **Solución**: Verifica que el ID existe: `SELECT * FROM catalog_titles WHERE tmdb_id = <ID>;`

### Todos los títulos siguen genéricos tras el UPDATE

- **Causa**: `original_title` también estaba vacío.
- **Solución**: Ejecuta `catalog-backfill` (Opción B) que llama a TMDB.

### Error 401 al invocar catalog-backfill

- **Causa**: Falta el header `x-catalog-sync-secret` o no coincide.
- **Solución**: Verifica que el secreto `CATALOG_SYNC_SECRET` existe en Supabase Edge Functions secrets.

### La app no cambia tras el deploy

- **Causa**: Cache de GitHub Pages o variables de entorno incorrectas.
- **Solución**: Verifica las variables en GitHub Settings → Actions → Variables. Fuerza un nuevo deploy. Limpia cache del navegador (Ctrl+Shift+R).
