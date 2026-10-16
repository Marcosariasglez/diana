// P6: razones puras para el feed rediseñado.
// Funciones 100% puras — sin efectos, sin estado global, sin imports de RN.

import type { Reason } from '@/types/media';
import type { HistoryEntry, TasteProfile } from '@/types/rating';
import { genreName } from '@/constants/genres';
import { GENRES_EN } from '@/constants/genresEn';

/** Géneros de género femenino en español (artículo "la"). */
const FEMALE_GENRES: ReadonlySet<number> = new Set([
  28,   // la acción
  12,   // la aventura
  16,   // la animación
  35,   // la comedia
  14,   // la fantasía
  36,   // la historia
  878,  // la ciencia ficción
  10753, // la guerra
  10402, // la música
  10751, // la familia
  // Nota: romance (10749) es masculino → "el romance"
]);

/**
 * Retorna el artículo (el/la) adecuado para un género dado.
 */
function genreArticle(genreId: number): string {
  return FEMALE_GENRES.has(genreId) ? 'la' : 'el';
}

/**
 * Nombre de género en español, minúscula, para texto de razón.
 * Usa `genreName()` de genres.ts como fuente de verdad; para ids
 * desconocidos cae a GENRES_EN en minúscula.
 */
export function genreNameLower(genreId: number): string {
  const name = genreName(genreId);
  // Si genreName cae a String(id), intenta GENRES_EN
  if (name === String(genreId)) {
    const en = GENRES_EN[genreId];
    if (en) return en.toLowerCase();
    return `género ${genreId}`;
  }
  return name.toLowerCase();
}

/** «90», «2000», «2010» a partir de una década (1990, 2000, 2010…). */
export function decadeLabel(decade: number): string {
  if (decade < 2000) return String(decade).slice(2); // 1990 → '90'
  return String(decade);
}

/** Umbral de peso por género para activar razón 'genre' (bp). */
const DEFAULT_GENRE_THRESHOLD = 3000;

/** Umbral mínimo de títulos calificados alto en la misma década. */
const ERA_MIN_TITLES = 3;

/** Umbral mínimo de porcentaje (0..1) para que una década sea preferida. */
const ERA_MIN_RATIO = 0.35;

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
  eraPref: number | null;
  /** Umbral de peso por género para activar razón 'genre'. */
  genreThreshold?: number;
}

/**
 * Calcula la razón de un ítem individual.
 * Prioridad: liked > genre > era > undefined.
 * Nunca inventa una razón.
 */
export function buildReason(ctx: ReasonContext): Reason | undefined {
  const threshold = ctx.genreThreshold ?? DEFAULT_GENRE_THRESHOLD;

  // 1. liked
  if (ctx.explanation.length > 0) {
    return { kind: 'liked', text: ctx.explanation[0] };
  }

  // 2. genre
  if (ctx.genreIds.length > 0) {
    const { genreId } = bestGenreByWeight(ctx.genreIds, ctx.taste, threshold);
    if (genreId !== undefined) {
      return { kind: 'genre', text: `Porque te gusta ${genreArticle(genreId)} ${genreNameLower(genreId)}` };
    }
  }

  // 3. era
  if (ctx.year !== null && ctx.eraPref !== null) {
    const titleDecade = Math.floor(ctx.year / 10) * 10;
    if (titleDecade === ctx.eraPref) {
      return { kind: 'era', text: `Porque buscas cine de los ${decadeLabel(ctx.eraPref)}` };
    }
  }

  return undefined;
}

/**
 * Retorna el género con mayor peso del perfil que esté en la lista,
 * siempre que supere el umbral.
 */
function bestGenreByWeight(
  genreIds: readonly number[],
  taste: TasteProfile,
  threshold: number,
): { genreId?: number } {
  let bestId: number | undefined;
  let bestWeight = 0;
  for (const g of genreIds) {
    const w = taste.weightBp[g] ?? 0;
    if (w >= threshold && (bestId === undefined || w > bestWeight || (w === bestWeight && g < bestId))) {
      bestId = g;
      bestWeight = w;
    }
  }
  return { genreId: bestId };
}

/**
 * Calcula la década preferida del usuario.
 * Umbral: ≥ 3 títulos valorados ≥ 4 ★ cuya década coincide,
 * y esa década representa ≥ 35 % de los títulos calificados alto.
 * Retorna la década (número: 1990, 2000…) o null.
 */
export function eraPreference(
  entries: ReadonlyArray<Pick<HistoryEntry, 'key' | 'userRating' | 'genreIds'>>,
  /** Años de cada entrada (del byIds de historial). */
  years: Map<string, number>,
): number | null {
  // Filtra entradas con rating alto (≥ 4 ★)
  const highRated = entries.filter((e) => e.userRating >= 4);
  if (highRated.length < ERA_MIN_TITLES) return null;

  // Cuenta por década
  const decadeCount = new Map<number, number>();
  for (const entry of highRated) {
    const year = years.get(entry.key);
    if (year === undefined) continue;
    const decade = Math.floor(year / 10) * 10;
    decadeCount.set(decade, (decadeCount.get(decade) ?? 0) + 1);
  }

  // Encuentra la mejor década
  let bestDecade: number | null = null;
  let bestCount = 0;
  for (const [decade, count] of decadeCount) {
    if (count >= ERA_MIN_TITLES && count >= highRated.length * ERA_MIN_RATIO) {
      if (count > bestCount || (count === bestCount && (bestDecade === null || decade > bestDecade))) {
        bestDecade = decade;
        bestCount = count;
      }
    }
  }

  return bestDecade;
}

/**
 * Retorna los ids de género con peso positivo, ordenados de mayor a menor.
 * Desempate: id ascendente.
 */
export function topGenres(taste: TasteProfile, maxCount = 10): number[] {
  const positive: { id: number; weight: number }[] = [];
  for (const [idStr, weight] of Object.entries(taste.weightBp)) {
    if (weight > 0) {
      positive.push({ id: Number(idStr), weight });
    }
  }
  positive.sort((a, b) => b.weight - a.weight || a.id - b.id);
  return positive.slice(0, maxCount).map((g) => g.id);
}

/**
 * Dados los géneros favoritos del usuario (top N), retorna un género NO en esa
 * lista para crear una fila exploratoria. Prioriza géneros comunes de película.
 */
export function pickExploreGenre(favoriteGenreIds: number[]): { id: number; name: string } | null {
  const favSet = new Set(favoriteGenreIds);
  // Géneros comunes de película por popularidad (IDs de genres.ts)
  const common = [35, 18, 28, 12, 14, 80, 9648, 10749, 878, 27, 16, 99, 10751, 53, 36];
  for (const g of common) {
    if (!favSet.has(g)) {
      return { id: g, name: genreNameLower(g) };
    }
  }
  return null;
}
