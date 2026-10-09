import type { Media, Movie } from '@/types/media';
import { ONBOARDING_COUNT, ONBOARDING_MAX_PER_MAIN_GENRE } from '@/constants/onboarding';
import { CATALOG } from '@/mocks/data/catalog';

const FIRST_TITLE = 'Aftersun';

/**
 * Mazo del onboarding (7.2) y arranque en frío (VERTICE-PLAN-2, D2-2.5):
 * determinista, Aftersun primero, reparto por turnos entre géneros principales
 * (genres[0]), máximo ONBOARDING_MAX_PER_MAIN_GENRE por género y sin dos cartas
 * consecutivas del mismo género principal mientras haya alternativa.
 *
 * Con `platforms` (el swipe de onboarding llega con 0 valoraciones): el mazo se
 * construye sobre los títulos DISPONIBLES en esas plataformas — «populares en
 * tus plataformas» (el orden por popularidad del pool se conserva). Si no hay
 * suficientes disponibles, se completa con el resto del catálogo (popular y
 * diverso) para no dejar el mazo corto. Sin `platforms` el comportamiento es
 * exactamente el de antes (contrato O2: Aftersun primero, 8+ géneros, etc.).
 */
export function getOnboardingDeckMovies(
  count: number = ONBOARDING_COUNT,
  catalog: ReadonlyArray<Media> = CATALOG,
  platforms?: ReadonlyArray<string>,
): Movie[] {
  const hasPlatforms = (platforms?.length ?? 0) > 0;
  const inPlatforms = (m: Media) => !hasPlatforms || m.platforms.some((p) => platforms?.includes(p));
  const movies = catalog.filter((m): m is Movie => m.media_type === 'movie');
  const inPlat = movies.filter(inPlatforms);
  // Pool: solo disponibles si son suficientes; si no, se completan con el resto.
  const pool = inPlat.length >= count ? inPlat : [...inPlat, ...movies.filter((m) => !inPlatforms(m))];
  const first = pool.find((m) => m.title === FIRST_TITLE);
  const deck: Movie[] = [];
  const used = new Map<number, number>();
  const mainOf = (m: Movie) => m.genres[0]?.id ?? 0;
  const take = (m: Movie) => {
    deck.push(m);
    used.set(mainOf(m), (used.get(mainOf(m)) ?? 0) + 1);
  };
  if (first && count > 0) take(first);

  const groups = new Map<number, Movie[]>();
  for (const m of pool) {
    if (m === first) continue;
    const g = mainOf(m);
    const list = groups.get(g) ?? [];
    list.push(m);
    groups.set(g, list);
  }
  for (const list of groups.values()) list.sort((a, b) => b.popularity - a.popularity || a.id - b.id);

  const sizeOf = (g: number) => (groups.get(g)?.length ?? 0) + (first && mainOf(first) === g ? 1 : 0);
  const order = [...groups.keys()].sort((a, b) => sizeOf(b) - sizeOf(a) || a - b);

  while (deck.length < count) {
    let progressed = false;
    // Si el primero de la vuelta repite el género de la última carta, se pasa al final.
    const round = [...order];
    const last = deck[deck.length - 1];
    if (last && round.length > 1 && round[0] === mainOf(last)) round.push(round.shift() as number);
    for (const g of round) {
      if (deck.length >= count) break;
      const list = groups.get(g);
      if (!list || list.length === 0) continue;
      if ((used.get(g) ?? 0) >= ONBOARDING_MAX_PER_MAIN_GENRE) continue;
      take(list.shift() as Movie);
      progressed = true;
    }
    if (!progressed) break;
  }
  return deck;
}
