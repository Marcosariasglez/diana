# Auditoría del mood — verificación 14-oct-2026

## Resumen

Todos los filtros duros del mood funcionan correctamente tras los ajustes de B2-B4.
Los tests de [`moodFilters.audit.test.ts`](../../src/mocks/mock-ai/__tests__/moodFilters.audit.test.ts) cubren
cada opción de cada pregunta.

## Tabla de verificación

| Pregunta | Opción | Regla aplicada | Test | Resultado |
|----------|--------|----------------|------|-----------|
| time | lt90 | `0 < runtime ≤ 89` (maxMinutes: 89) | audit:lt90 | ✅ |
| time | h2 | `90 ≤ runtime ≤ 150` (min:90, max:150) | audit:h2 | ✅ |
| time | marathon | `runtime ≥ 151` (minMinutes: 151) | audit:marathon | ✅ |
| time | series | `mediaType === 'tv'` | audit:series | ✅ |
| era | new | `year ≥ 2020` | audit:new | ✅ |
| era | modern | `2000 ≤ year ≤ 2019` | audit:modern | ✅ |
| era | classic | `1 ≤ year ≤ 1999` (año 0 → descartado) | audit:classic | ✅ |
| era | any | Sin restricción | audit:any | ✅ |
| platforms | (multi) | Intersección con `media.platforms` | audit:platforms | ✅ |
| energy | calm/company/intense | Boost géneros (no descarta) | audit:energy | ✅ |
| company | solo/pareja/amigos | Boost géneros (no descarta) | audit:company | ✅ |
| pace | lento/medio/rápido | Boost géneros (no descarta) | audit:pace | ✅ |

## Bugs corregidos

1. **B2 — Solape de tramos de duración:** `lt90` tenía `maxMinutes: 90` (incluía 90), y `marathon` tenía `minMinutes: 150` (solapaba con h2). Corregido a 89 / 90-150 / 151.
2. **B2 — Duración desconocida:** Antes `runtime ≤ 0` pasaba el filtro. Ahora se descarta (`return false`).
3. **B3 — Año desconocido:** Antes `year === 0` pasaba "Clásico". Ahora se descarta.

## Observación para el dueño

`rowToMedia` calcula `platforms` con flatrate + alquiler + compra. Es decir, si el mood filtra
por "Netflix", también acepta títulos que solo se alquilan o compran en Netflix.
**Esto es una decisión de producto pendiente.**

## Cobertura de duración en el catálogo

Consulta SQL para verificar (P4 del plan):

```sql
select count(*) filter (where runtime is null) as pendientes,
       count(*) filter (where runtime > 0)     as con_duracion,
       count(*) filter (where runtime = 0)     as sin_dato_en_tmdb
from public.catalog_titles;
```

Mientras `con_duracion` sea bajo, los filtros de duración devolverán pocos resultados.
Esto es correcto: no se debe compensar relajando el filtro.
