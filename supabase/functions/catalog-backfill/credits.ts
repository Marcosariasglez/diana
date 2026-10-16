// Lectura PURA de los créditos de TMDB (sin Deno ni red): así se puede probar
// con Jest. La usa el modo `credits` de la Edge Function `catalog-backfill`.

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;

/** Directores que se guardan por título (las series pueden tener decenas). */
export const MAX_DIRECTORS = 4;
/** Reparto principal que se guarda por título. */
export const MAX_CAST = 5;

const clean = (name: unknown): string => (typeof name === 'string' ? name.trim() : '');

function unique(names: string[]): string[] {
  return [...new Set(names.filter((n) => n !== ''))];
}

/** Episodios que `member` dirigió: en aggregate_credits el puesto va en `jobs`, no en `job`. */
function directedEpisodes(member: AnyRecord): number {
  if (Array.isArray(member.jobs)) {
    return member.jobs
      .filter((j: AnyRecord) => j?.job === 'Director')
      .reduce((sum: number, j: AnyRecord) => sum + (Number(j.episode_count) || 1), 0);
  }
  return member.job === 'Director' ? 1 : 0;
}

/**
 * Créditos de la respuesta de TMDB:
 *  - película (`/movie/{id}/credits`): `crew[].job === 'Director'`;
 *  - serie (`/tv/{id}/aggregate_credits`): `crew[].jobs[].job === 'Director'`,
 *    ordenados por episodios dirigidos (los más implicados primero).
 */
export function creditsFromResponse(
  _mediaType: 'movie' | 'tv',
  data: AnyRecord,
): { directors: string[]; cast_top: string[] } {
  const crew: AnyRecord[] = Array.isArray(data?.crew) ? data.crew : [];
  const cast: AnyRecord[] = Array.isArray(data?.cast) ? data.cast : [];
  const directors = crew
    .map((member, index) => ({ name: clean(member?.name), episodes: directedEpisodes(member ?? {}), index }))
    .filter((m) => m.name !== '' && m.episodes > 0)
    .sort((a, b) => b.episodes - a.episodes || a.index - b.index)
    .map((m) => m.name);
  return {
    directors: unique(directors).slice(0, MAX_DIRECTORS),
    cast_top: unique(cast.slice(0, MAX_CAST).map((c) => clean(c?.name))),
  };
}
