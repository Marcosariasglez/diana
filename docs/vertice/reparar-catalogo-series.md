# Reparar el catálogo: series guardadas como películas (2026-10-13)

## Qué pasaba

`catalog-sync` decidía el tipo de cada título con `r.media_type`, pero
`/discover/tv` de TMDB **no devuelve ese campo**. Todas las series se guardaron
como `media_type = 'movie'`:

| Dato en producción (13-oct) | Valor |
|---|---|
| Filas `movie` | 39.618 |
| Filas `tv` | **0** |
| Filas con `title` vacío | 5.896 (casi todas series: géneros TV 10759/10765…) |
| Filas con `runtime` relleno | **0** (discover no trae duración) |

Lo que veías en la app:

- **«Película 9772» / sin título**: una serie sin `title` (las series traen `name`).
- **«Ley y Orden: UVE» como «La Biblia: David»**: el backfill pidió `/movie/2734`
  para una serie y le puso el título de la película que comparte ese id.
- **Ficha «no existe»**: la app pide `/movie/<id de serie>` a TMDB.
- **Mood vacío**: sin `runtime`, «Unas 2 horas» y «Maratón» descartaban todo, y
  «Una serie» no encontraba ninguna fila `tv`.
- **Series al pedir películas**: estaban guardadas como películas.

Además, cuando el id de una serie coincidía con el de una película real, el
upsert de la serie **sobrescribió** el póster, los géneros y la popularidad de
esa película, y le sumó las plataformas de la serie. Por eso la reparación
recomendada es reconstruir, no parchear.

## Ya arreglado en el código

- `catalog-sync`: el tipo sale del job (`/discover/movie` o `/discover/tv`), y
  cada upsert marca `updated_at`.
- `catalog-backfill`: nuevo `mode: "runtime"` que rellena la duración desde el
  detalle de TMDB. El workflow tiene el selector `mode`.
- App: el mood trata la duración desconocida como «no descarta», una duración
  implica película y «Una serie» implica serie (el pool se pide ya del tipo
  correcto); Explorar, Inicio y el mood ocultan filas sin título; la rejilla
  de Explorar está centrada.

## Pasos (en orden)

### 1. Desplegar las funciones corregidas

```bash
cd diana-tmp
npx supabase functions deploy catalog-sync --project-ref hvjmewokgxgrshtzhdjq
npx supabase functions deploy catalog-backfill --project-ref hvjmewokgxgrshtzhdjq
```

### 2. Vaciar el catálogo (SQL Editor de Supabase)

⚠️ Mientras dure la re-sincronización, la app verá el catálogo a medias.

```sql
begin;
truncate public.catalog_sync_state;
truncate public.catalog_titles;
commit;
```

`catalog_features` (los embeddings del recomendador) **se conserva**: las filas
de películas reales siguen siendo válidas, y el cron de `catalog-features`
genera solo las que faltan (las series nuevas).

### 3. Re-sincronizar

GitHub → Actions → **catalog-sync** → *Run workflow* → `mode = full`,
`resync = true`. El workflow se relanza solo hasta terminar (varias horas).

Para comprobarlo:

```sql
select media_type, count(*), count(*) filter (where title = '') as sin_titulo
from public.catalog_titles group by 1;
```

Deberías ver filas `tv` y `sin_titulo` ≈ 0.

### 4. Rellenar la duración

No hace falta hacer nada: el cron diario de **catalog-backfill** ejecuta ahora
los dos modos (`titles` y luego `runtime`). Empieza por los títulos más
populares y rellena unos 10.000 al día, así que los ~40.000 iniciales tardan
unos 4 días. Después, cada día solo rellena lo que haya traído la sync. Para ir
más rápido, lánzalo a mano: Actions → **catalog-backfill** → *Run workflow* →
`mode = runtime`.

```sql
select count(*) filter (where runtime is null) as pendientes,
       count(*) filter (where runtime > 0)     as con_duracion
from public.catalog_titles;
```

### Alternativa sin vaciar (no recomendada)

Haz el paso 1 y apunta la hora (`select now();` → T0). Lanza `full` con
`resync = true` y, cuando termine:

```sql
delete from public.catalog_titles where updated_at < 'T0';
```

Así desaparecen las series mal guardadas que nadie ha vuelto a descubrir, pero
las películas reales cuyo id coincidía con una serie se quedan con las
plataformas de esa serie.

## Nota sobre `primary_media_type` (migración 0022)

No está aplicada en producción y **no hace falta**: ni la app ni las funciones
leen esa columna. TMDB no tiene un tipo «corto» o «documental». Los documentales
son películas con el género 99 (hay 6.810 en la base), y se filtran por género.
