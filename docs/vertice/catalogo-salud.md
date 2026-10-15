# Salud del Catálogo (F5-1)

Script `scripts/catalog-health.mjs`: auditoría de calidad del catálogo `catalog_titles`.

## Uso

```bash
node scripts/catalog-health.mjs
```

Requiere `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` o variables de entorno.

### Degradación

Sin credenciales → imprime advertencia y sale con código 0 (no bloquea el pipeline).

## Métricas

Por cada tipo (`movie`, `tv`):

| Métrica | Qué mide | Umbral |
|---------|----------|--------|
| `total` | Filas en `catalog_titles` | — |
| `sin_titulo` | `title = ''` | 0 esperado |
| `sin_genero` | `genre_ids = '{}'` | < 5% del total |
| `sin_poster` | `poster_path IS NULL` | Bajo (solo títulos sin póster en TMDB) |
| `runtime_pendiente` | `runtime IS NULL` | 0 tras backfill `runtime` |
| `sin_plataforma` | Sin flatrate, rent ni buy | Bajo (estuvieron en discover pero ya no están disponibles) |

## Interpretación

- **`sin_genero` alto (> 5%)**: Ejecutar backfill de `genre_ids` (añadir modo `genre` a `catalog-backfill`).
- **`runtime_pendiente` > 0**: Ejecutar `catalog-backfill` con `mode: runtime` (workflow o manual).
- **`sin_titulo` > 0**: Ejecutar `catalog-backfill` con `mode: titles` (stubs de discover).
- **`sin_poster`**: Normal si TMDB no tiene póster (títulos muy antiguos o retirados).

## SQL equivalente

```sql
select
  media_type,
  count(*)::int as total,
  count(*)::int filter (where title = '') as sin_titulo,
  count(*)::int filter (where coalesce(genre_ids, '{}')::text = '{}') as sin_genero,
  count(*)::int filter (where poster_path is null or poster_path = '') as sin_poster,
  count(*)::int filter (where runtime is null) as runtime_pendiente,
  count(*)::int filter (where
    coalesce(platforms_flatrate, '{}')::text = '{}' and
    coalesce(platforms_rent, '{}')::text = '{}' and
    coalesce(platforms_buy, '{}')::text = '{}'
  ) as sin_plataforma
from public.catalog_titles
group by 1;
```
