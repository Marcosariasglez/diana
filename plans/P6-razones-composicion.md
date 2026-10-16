# P6 · Razones y composición pura

> Parte del plan `rediseño-inicio-explorar.md`. Complejidad: L.
> Archivos: `reasons.ts`, `composeFeed.ts`, `rowCatalog.ts`, `types/media.ts` + tests.

---

## Resumen de dependencias existentes

| Dependencia | Ubicación | Contrato relevante |
|---|---|---|
| `TasteProfile` | `src/types/rating.ts:42-45` | `{ userId, weightBp: Record<number, number> }` |
| `Media` | `src/types/media.ts` | `Movie` o `TVSeries` con `genres`, `media_type`, fechas |
| `ContentRecommendation` | `src/services/recommender.ts:17-23` | `{ media, score, explanation: string[] }` |
| `GENRES_EN` | `src/constants/genresEn.ts:6-36` | `Record<number, string>` id TMDB → nombre EN |
| `titleOf`, `releaseYearOf` | `src/utils/media.ts` | Helpers puros para Media |
| `HistoryEntry` | `src/types/rating.ts:14-29` | `{ userRating, genreIds?, ... }` |
| `AffinityBucket` | `src/types/media.ts:51` | `'alto' \| 'medio' \| 'bajo'` |
| `FeedCategory` | `src/types/media.ts:61-66` | Shape actual, queda como alias |
| `CatalogRow` | `src/services/supabase/catalog/types.ts` | Fila BD con `genre_ids`, `year`, `platforms_flatrate` |
| `BrowseParams` | `src/services/supabase/catalog/types.ts:36-52` | Soporta `genres?: number[]` (ya modificado en P2) |

---

## 1. Tipos nuevos en `src/types/media.ts`

### 1.1 `Reason`

```ts
/** Razón de recomendación (expuesta al usuario, nunca nota numérica). */
export type ReasonKind = 'liked' | 'genre' | 'era';

export interface Reason {
  kind: ReasonKind;
  /** Texto visible: «Porque te gustó X», «Porque te gusta el drama», «Porque buscas cine de los 90». */
  text: string;
}
```

### 1.2 `FeedItem`

```ts
/** Ítem de feed: MediaWithAffinity extendido con razón. */
export interface FeedItem extends MediaWithAffinity {
  reason?: Reason;
}
```

### 1.3 `FeedRow`

```ts
/** Fila del feed de Inicio: título + ítems + razón opcional + enlace «Ver todo». */
export interface FeedRow {
  /** Id único: puede ser string libre como 'genre-18', 'decade-1990', 'liked-movie-496243', 'popular', 'top-rated'. */
  id: string;
  /** Título de sección: «Joyas ocultas», «Porque te gustó Sicario», etc. */
  title: string;
  /** Subtítulo de razón: «Basado en tus valoraciones de thriller» (vacío si no aplica). */
  subtitle?: string;
  items: FeedItem[];
  /** Categoría de see-all (null si no hay «Ver todo»). */
  seeAll?: string | null;
}
```

> **Nota:** `FeedCategory` queda como alias temporal mientras se migra `see-all`.

---

## 2. `src/recommender/reasons.ts`

Funciones **puras**, sin efectos secundarios, sin imports de React Native.

### 2.1 `buildReason()`

```ts
interface ReasonContext {
  /** Explicación del RPC recommend: ['Porque te gustó X'] o []. */
  explanation: string[];
  /** Géneros del título (del enriquecimiento byIds). */
  genreIds: number[];
  /** Año del título (del enriquecimiento). */
  year: number | null;
  /** Perfil de gusto del usuario. */
  taste: TasteProfile;
  /** Preferencia de época calculada (null si no aplica). */
  eraPref: number | null; // década como número: 1990, 2000, 2010...
  /** Umbral de peso por género para activar razón 'genre'. */
  genreThreshold?: number; // default: 3000 bp
}

/**
 * Calcula la razón de un ítem individual.
 * Prioridad: liked > genre > era > null.
 * Nunca inventa una razón.
 */
export function buildReason(ctx: ReasonContext): Reason | undefined;
```

**Algoritmo:**

1. Si `explanation` no está vacío → `{ kind: 'liked', text: explanation[0] }`.
2. Si hay `genreIds`, encontrar el género con más peso en `taste.weightBp` ≥ `genreThreshold` → `{ kind: 'genre', text: 'Porque te gusta el {género en minúscula}' }`. Usar `GENRES_EN` para el nombre y formatearlo.
3. Si `year` existe y `eraPref` existe, la década del título coincide con `eraPref` → `{ kind: 'era', text: 'Porque buscas cine de los {90}' }`.
4. Si nada aplica → `undefined`.

### 2.2 `eraPreference()`

```ts
/**
 * Calcula la década preferida del usuario.
 * Umbral: ≥ 3 títulos valorados ≥ 4 ★ cuya década coincide,
 * y esa década representa ≥ 35 % de los títulos calificados alto.
 * Retorna la década (número: 1990, 2000...) o null.
 */
export function eraPreference(
  entries: ReadonlyArray<Pick<HistoryEntry, 'userRating' | 'genreIds'>>,
  /** Años de cada entrada (del byIds de historial). */
  years: Map<string, number>, // MediaKey → year
): number | null;
```

**Algoritmo:**

1. Filtra entradas con `userRating >= 4`.
2. Para cada entrada, obtiene el año del `years` map y calcula la década (`Math.floor(year / 10) * 10`).
3. Cuenta títulos por década.
4. La década gana si tiene ≥ 3 títulos Y representa ≥ 35 % del total de calificaciones altas.
5. Si hay empate, la más reciente. Si nada cumple → `null`.

### 2.3 `topGenres()`

```ts
/**
 * Retorna los ids de género con peso positivo, ordenados de mayor a menor.
 * Desempate: id ascendente.
 */
export function topGenres(taste: TasteProfile, maxCount?: number): number[];
```

**Algoritmo:**

1. Filtra `taste.weightBp` con valor > 0.
2. Ordena descendente por peso, empate por id ascendente.
3. Recorta a `maxCount` (default: 10).

### 2.4 `genreNameLower()`

```ts
/** Nombre de género en español, minúscula, para texto de razón. */
export function genreNameLower(genreId: number): string;
```

Usa un mapa ES para los géneros más comunes (Drama, Comedia, Acción, Thriller, etc.). Para los no mapeados, usa `GENRES_EN[genreId]` traducido con `toLocaleLowerCase()`.

### 2.5 `decadeLabel()`

```ts
/** «90», «2000», «2010» a partir de una década (1990, 2000, 2010...). */
export function decadeLabel(decade: number): string;
```

---

## 3. `src/features/feed/rowCatalog.ts`

Definición de filas **variadas** del catálogo (no personalizadas). Cada fila tiene un id, título y una función de consulta.

### 3.1 `RowDefinition`

```ts
import type { BrowseParams } from '@/services/supabase/catalog/types';

export interface RowDefinition {
  id: string;
  title: string;
  /** Parámetros de consulta al catálogo (sin plataformas, se inyectan después). */
  params: Omit<BrowseParams, 'platforms' | 'cursor' | 'limit'>;
  /** Si tiene id de categoría, enlaza a «Ver todo». */
  seeAll?: string;
}
```

### 3.2 Filas definidas

```ts
export const ROW_CATALOG: RowDefinition[] = [
  {
    id: 'hidden-gems',
    title: 'Joyas ocultas',
    params: { sort: 'vote' },
    // La heurística de joyas ocultas se aplica en composeFeed (filtra por popularidad baja + voto alto)
  },
  {
    id: 'popular',
    title: 'Populares en tus plataformas',
    params: { sort: 'popularity' },
  },
  {
    id: 'top-rated',
    title: 'Mejor valoradas',
    params: { sort: 'vote' },
  },
  {
    id: 'tv',
    title: 'Series para maratonear',
    params: { type: 'tv', sort: 'popularity' },
  },
];

/** Filas de género exploratorio: se generan dinámicamente con géneros fuera del top del usuario. */
export function genreExploreRow(genreId: number, genreName: string): RowDefinition {
  return {
    id: `genre-${genreId}`,
    title: `Explora: ${genreName}`,
    params: { genre: genreId },
    seeAll: `genre-${genreId}`,
  };
}

export function getRowById(id: string): RowDefinition | undefined {
  return ROW_CATALOG.find(r => r.id === id);
}
```

---

## 4. `src/features/feed/composeFeed.ts`

Función **pura** que recibe recomendaciones + enriquecimiento + gusto y devuelve `{ hero, top10, rows }`.

### 4.1 Signatura

```ts
import type { FeedItem, FeedRow, Media } from '@/types/media';
import type { TasteProfile } from '@/types/rating';
import type { ContentRecommendation } from '@/services/recommender';

interface ComposeFeedInput {
  /** Recomendaciones del RPC o heurística (ordenadas por score). */
  recs: ContentRecommendation[];
  /** Mapa de enriquecimiento: MediaKey → Media completa (con géneros, año, backdrop). */
  enriched: Map<string, Media>;
  /** Perfil de gusto. */
  taste: TasteProfile;
  /** Década preferida (null si no aplica). */
  eraPref: number | null;
  /** Claves ya vistas (para excluir del feed). */
  seenKeys: ReadonlySet<string>;
  /** Plataformas del usuario (para filas variadas). */
  platforms: string[];
}

interface ComposeFeedOutput {
  hero: FeedItem[];       // 5 ítems para HeroCarousel
  top10: FeedItem[];      // 10 ítems para Top10Row
  rows: FeedRow[];        // Filas personalizadas + variadas, alternadas
}

export function composeFeed(input: ComposeFeedInput): ComposeFeedOutput;
```

### 4.2 Algoritmo

```
1. Convierte recs[] en FeedItem[] enriquecidos:
   - Para cada rec, busca en enriched el Media completo.
   - Si no hay enriquecimiento, usa rec.media (sin géneros/año → razón limitada).
   - Aplica buildReason() con el contexto completo.
   - Filtra los que están en seenKeys.

2. Hero (5 ítems):
   - De los 20 mejores por score:
     - Maximiza variedad: como mucho 2 con la misma reason.kind y 2 del mismo genre principal.
     - Prefiere los que tienen backdrop_path (del enriquecimiento).
   - Si no hay 5 con variedad, rellena por score.
   - Si hay < 1, hero = [].

3. Top 10:
   - Los 10 mejores restantes por score (sin repetir los del hero).
   - Si hay < 5, se oculta en la UI (la pantalla decide).

4. Filas personalizadas (con lo que queda de recs):
   - Agrupa por reason.kind + detalle.
   - «Porque te gustó X» por cada X con ≥ 4 títulos (máx. 2 filas).
   - «Porque te gusta el {género}» para los 2 géneros con más peso.
   - «Cine de los {década}» si hay eraPref y ≥ 3 títulos.
   - Cada fila: title = razón principal, subtitle = contexto adicional.

5. Filas variadas (rowCatalog):
   - Para cada RowDefinition en ROW_CATALOG:
     - La consulta se hace lazily (el hook llama al catálogo con los params).
     - Se marca como "variada" para la alternancia.
   - Género exploratorio: 1 fila con un género NO en el top-5 del usuario.

6. Alternancia:
   - Interleava personalizada / variada.
   - Las 3 primeras filas llegan completas; el resto se marcan para carga progresiva.

7. Deduplicación global por `media_type:id` en todo el feed.
```

### 4.3 Degradación

Cuando `recs` está vacío (sin sesión, RPC caído, `RECOMMENDER=heuristic`):

- `hero` = [] (la pantalla mostrará skeleton o contenido del catálogo heurístico)
- `top10` = []
- `rows` = filas variadas de `rowCatalog` (sin personalización)

La función es pura: la degradación la orquesta el hook (`usePersonalizedFeed`) que decide si pasar recs vacíos o no.

---

## 5. Tests

### 5.1 `src/recommender/reasons.test.ts`

| Caso | Descripción |
|---|---|
| liked prioridad | `buildReason({ explanation: ['Porque te gustó X'], ... })` → `{ kind: 'liked' }` incluso si genre y era aplican |
| genre sin liked | `buildReason({ explanation: [], genreIds: [18], taste: { weightBp: { 18: 5000 } }, ... })` → `{ kind: 'genre', text: 'Porque te gusta el drama' }` |
| genre bajo umbral | `weightBp: { 18: 1000 }` con threshold 3000 → `undefined` |
| era coincide | `year: 1995, eraPref: 1990` → `{ kind: 'era', text: 'Porque buscas cine de los 90' }` |
| era no coincide | `year: 2020, eraPref: 1990` → `undefined` |
| eraPref null | `eraPref: null` → no activa era |
| sin nada | `explanation: [], genreIds: [], year: null` → `undefined` |
| eraPreference umbral | ≥ 3 títulos ≥ 4★ en misma década, ≥ 35% → retorna década |
| eraPreference bajo umbral | 2 títulos en década → `null` |
| eraPreference porcentaje bajo | 3 títulos pero solo 20% → `null` |
| topGenres orden | `weightBp: { 18: 8000, 28: 5000, 35: 3000 }` → `[18, 28, 35]` |
| topGenres maxCount | `maxCount: 2` → `[18, 28]` |
| decadeLabel | `1990` → «90», `2000` → «2000», `2010` → «2010» |

### 5.2 `src/features/feed/composeFeed.test.ts`

| Caso | Descripción |
|---|---|
| hero variado | 5 hero, como mucho 2 misma razón y 2 mismo género |
| hero < 5 | Con 3 recs → hero de 3, top10 con el resto |
| hero < 1 | Sin recs → hero = [] |
| top10 sin hero | Los 10 top no repiten los del hero |
| top10 < 5 | Con 7 recs → hero 5, top10 2 |
| deduplicación global | Un `media_type:id` aparece una sola vez en todo el output |
| filas personalizadas | Agrupadas por razón, máx 2 «Porque te gustó X» |
| filas alternadas | Personalizada / variada alternadas |
| degradación sin recs | `recs: []` → hero=[], top10=[], rows=filas variadas |
| seenKeys excluye | Los items en `seenKeys` no aparecen en el output |
| backdrop preferido | Cuando hay elección, el ítem con `backdrop_path` gana |
| género exploratorio | Una fila de género NO en top-5 del usuario |

---

## 6. Diagrama de flujo

```mermaid
flowchart TD
    A[usePersonalizedFeed] --> B[contentRecommend limit 80]
    B --> C{respondió?}
    C -->|si| D[byIds por tipo para enriquecer]
    C -->|no| E[recs vacíos - degradación]
    D --> F[composeFeed]
    E --> F
    F --> G[buildReason por ítem]
    G --> H[Hero 5 variados]
    G --> I[Top 10 restantes]
    G --> J[Filas personalizadas]
    J --> K[rowCatalog filas variadas]
    K --> L[Alternar personal/variada]
    L --> M[Deduplicar global]
    M --> N[{hero, top10, rows}]
```

---

## 7. Reglas

- **Tests primero**: escribir los tests para que fallen sin la implementación.
- **Funciones puras**: `reasons.ts` y `composeFeed.ts` son 100% puras (sin side effects, sin estado global).
- **Ningún color suelto**: los tests de UI usarán tokens existentes.
- **Nota IA oculta**: `buildReason` NUNCA devuelve nada numérico. Verificar con `noAiScore.test.tsx` en P9.
- **Commits pequeños en español**: un commit por sub-tarea.
- **Batería tras cada cambio**: `npm run verify` + `node scripts/auditoria-estilos.mjs`.
