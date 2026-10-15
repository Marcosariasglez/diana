// Rediseño Explorar (plan P1): detecta en el texto del buscador palabras que
// son filtros (género, plataforma, década, tipo) para ofrecerlas como chips
// «+ Género: Thriller». PURO. El texto no se altera: `applyHint` devuelve los
// filtros nuevos y el texto sin la palabra.
import { GENRES } from '@/constants/genres';
import { PLATFORMS } from '@/constants/platforms';
import { DECADES, decadeLabel, setDecade, setType, toggleGenre, togglePlatform, type ExploreFilters } from './exploreFilters';

export type QueryHintKind = 'genre' | 'platform' | 'decade' | 'type';

export interface QueryHint {
  kind: QueryHintKind;
  /** id de género, id de plataforma, década (1990) o 'movie' | 'tv'. */
  value: string | number;
  /** Texto del chip: «Género: Thriller», «Netflix», «1990–1999», «Series». */
  label: string;
  /** Posición de la palabra en el texto ORIGINAL (start inclusive, end exclusive). */
  start: number;
  end: number;
}

/** Minúsculas y sin tildes, carácter a carácter: los índices coinciden con el original. */
function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += base.length === ch.length ? base : ch.toLowerCase();
  }
  return out;
}

interface Term {
  kind: Exclude<QueryHintKind, 'decade'>;
  value: string | number;
  label: string;
  words: string[];
}

const GENRE_ALIASES: Record<number, string[]> = {
  53: ['thriller', 'thrillers', 'suspenso'],
  878: ['sci-fi', 'scifi', 'sci fi', 'ciencia-ficcion'],
  28: ['accion'],
  18: ['dramas'],
  35: ['comedias'],
  99: ['documentales'],
  27: ['miedo'],
  10749: ['romantica', 'romanticas'],
  16: ['animada', 'animadas'],
};

const PLATFORM_ALIASES: Record<string, string[]> = {
  'prime-video': ['prime', 'amazon', 'amazon prime'],
  'disney-plus': ['disney', 'disney+'],
  'apple-tv': ['apple tv', 'apple'],
  'movistar-plus': ['movistar', 'movistar+'],
  max: ['hbo'],
};

const TYPE_WORDS: Array<{ value: 'movie' | 'tv'; label: string; words: string[] }> = [
  { value: 'tv', label: 'Series', words: ['serie', 'series'] },
  { value: 'movie', label: 'Películas', words: ['pelicula', 'peliculas', 'peli', 'pelis', 'film', 'films'] },
];

const TERMS: Term[] = [
  ...GENRES.map((g) => ({
    kind: 'genre' as const,
    value: g.id,
    label: `Género: ${g.name}`,
    words: [fold(g.name), ...(GENRE_ALIASES[g.id] ?? [])],
  })),
  ...PLATFORMS.map((p) => ({
    kind: 'platform' as const,
    value: p.id,
    label: p.name,
    words: [fold(p.name), p.id.replace(/-/g, ' '), ...(PLATFORM_ALIASES[p.id] ?? [])],
  })),
  ...TYPE_WORDS.map((t) => ({ kind: 'type' as const, value: t.value, label: t.label, words: t.words })),
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Palabra completa (no dentro de otra): delimitada por inicio/fin o por algo que no sea letra/número. */
const wordRe = (word: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(word)}(?![\\p{L}\\p{N}])`, 'u');

/** «90», «90s», «los 90», «años 90», «anos 1990», «1994», «2010s». Devuelve la década o null. */
function decadeFrom(raw: string): number | null {
  const n = Number(raw.replace(/s$/, ''));
  if (!Number.isFinite(n)) return null;
  const full = raw.replace(/s$/, '').length === 4 ? n : n >= 30 ? 1900 + n : 2000 + n;
  const decade = Math.floor(full / 10) * 10;
  return DECADES.includes(decade) ? decade : null;
}

const DECADE_RES: RegExp[] = [
  /(?<![\p{L}\p{N}])(?:anos|decada de|decada)\s+(?:de\s+)?(?:los\s+)?((?:19|20)\d0s?|\d0s?)(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])((?:19|20)\d0s|\d0s)(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])((?:19|20)\d{2})(?![\p{L}\p{N}])/gu,
];

/** Pistas de filtro presentes en `text`, ordenadas por posición y sin repetir valor. */
export function extractHints(text: string): QueryHint[] {
  const folded = fold(text);
  const found: QueryHint[] = [];
  const seen = new Set<string>();
  const push = (hint: QueryHint) => {
    const key = `${hint.kind}:${hint.value}`;
    if (seen.has(key)) return;
    // No solapar con una pista ya encontrada (la más larga/específica gana por orden de inserción).
    if (found.some((h) => hint.start < h.end && h.start < hint.end)) return;
    seen.add(key);
    found.push(hint);
  };

  for (const re of DECADE_RES) {
    for (const m of folded.matchAll(re)) {
      const decade = decadeFrom(m[1]);
      if (decade === null || m.index === undefined) continue;
      push({ kind: 'decade', value: decade, label: decadeLabel(decade), start: m.index, end: m.index + m[0].length });
    }
  }

  for (const term of TERMS) {
    for (const word of term.words) {
      const m = wordRe(word).exec(folded);
      if (!m) continue;
      push({ kind: term.kind, value: term.value, label: term.label, start: m.index, end: m.index + m[0].length });
      break;
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

/** Convierte la pista en filtro y quita la palabra del texto (colapsando espacios). */
export function applyHint(
  filters: ExploreFilters,
  hint: QueryHint,
): ExploreFilters {
  const query = `${filters.query.slice(0, hint.start)} ${filters.query.slice(hint.end)}`.replace(/\s+/g, ' ').trim();
  const base = { ...filters, query };
  switch (hint.kind) {
    case 'genre':
      return base.genres.includes(hint.value as number) ? base : toggleGenre(base, hint.value as number);
    case 'platform':
      return base.platforms.includes(hint.value as string) ? base : togglePlatform(base, hint.value as string);
    case 'decade':
      return base.decade === hint.value ? base : setDecade(base, hint.value as number);
    case 'type':
      return setType(base, hint.value as 'movie' | 'tv');
  }
}

/** Pistas que aún no son filtro activo (lo que la UI debe ofrecer). */
export function pendingHints(filters: ExploreFilters): QueryHint[] {
  return extractHints(filters.query).filter((h) => {
    switch (h.kind) {
      case 'genre':
        return !filters.genres.includes(h.value as number);
      case 'platform':
        return !filters.platforms.includes(h.value as string);
      case 'decade':
        return filters.decade !== h.value;
      case 'type':
        return filters.type !== h.value;
    }
  });
}
