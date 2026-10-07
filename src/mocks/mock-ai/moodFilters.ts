import type { Media, Movie } from '@/types/media';
import type { MediaKey, RankingContext } from '@/types/rating';
import type { MoodEffect, MoodFilters } from '@/types/mood';
import { QUESTIONS } from '@/features/mood/questions';
import { CATALOG, mediaKeyOf, releaseYearOf, runtimeOf } from '@/mocks/data/catalog';
import { hash32 } from '@/utils/hash';
import { predictTenths } from './predict';
import { noiseBp, type NoiseFn } from './taste';

export const MAX_BOOST_MATCHES = 8;
export const BOOST_WEIGHT_TENTHS = 4;

const QUESTION_ORDER = ['time', 'energy', 'company', 'era', 'pace', 'platforms'] as const;

/** Efectos de las respuestas dadas; una pregunta sin responder (o con id desconocido) no aporta. */
export function effectsFor(filters: MoodFilters): { effects: MoodEffect[]; platformIds: string[] } {
  const effects: MoodEffect[] = [];
  const platformIds: string[] = [];
  for (const qid of QUESTION_ORDER) {
    const answer = filters.answers[qid];
    if (!answer) continue;
    const question = QUESTIONS[qid];
    const ids = question.selection === 'multiple' ? answer.split(',').filter(Boolean) : [answer];
    for (const id of ids) {
      const option = question.options.find((o) => o.id === id);
      if (!option) continue;
      if (option.effect.kind === 'platform') platformIds.push(option.effect.platformId);
      else effects.push(option.effect);
    }
  }
  return { effects, platformIds };
}

function passesHard(
  media: Media,
  effects: MoodEffect[],
  platformIds: string[],
  fallback: string[],
): boolean {
  for (const e of effects) {
    if (e.kind === 'runtime') {
      const rt = runtimeOf(media);
      if (e.minMinutes !== undefined && rt < e.minMinutes) return false;
      if (e.maxMinutes !== undefined && rt > e.maxMinutes) return false;
    } else if (e.kind === 'mediaType') {
      if (media.media_type !== e.mediaType) return false;
    } else if (e.kind === 'era') {
      const y = releaseYearOf(media);
      if (e.fromYear !== undefined && y < e.fromYear) return false;
      if (e.toYear !== undefined && y > e.toYear) return false;
    }
  }
  // Sin plataformas respondidas se usa el filtro global; una lista vacia no restringe.
  const wanted = platformIds.length > 0 ? platformIds : fallback;
  if (wanted.length > 0 && !media.platforms.some((p) => wanted.includes(p))) return false;
  return true;
}

/**
 * Aplica filtros duros (runtime, mediaType, era, plataforma) y calcula boostMatches.
 * Devuelve los candidatos que pasan, ordenados por boostMatches descendente (estable).
 */
export function applyMoodFilters(
  candidates: ReadonlyArray<Media>,
  filters: MoodFilters,
): Array<{ media: Media; boostMatches: number }> {
  const { effects, platformIds } = effectsFor(filters);
  const boost = new Set<number>();
  for (const e of effects) if (e.kind === 'genres') e.boost.forEach((g) => boost.add(g));

  const out: Array<{ media: Media; boostMatches: number; order: number }> = [];
  candidates.forEach((media, order) => {
    if (!passesHard(media, effects, platformIds, filters.fallbackPlatforms)) return;
    const matches = media.genres.filter((g) => boost.has(g.id)).length;
    out.push({ media, boostMatches: Math.min(MAX_BOOST_MATCHES, matches), order });
  });
  return out
    .sort((a, b) => b.boostMatches - a.boostMatches || a.order - b.order)
    .map(({ media, boostMatches }) => ({ media, boostMatches }));
}

/** Resultados personales: predictTenths + 4 * boostMatches desc, desempate por id; sin vistos. */
export function rankMoodResults(
  filters: MoodFilters,
  ctx: RankingContext,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): Array<{ media: Media; key: MediaKey; tenths: number; score: number }> {
  const unseen = catalog.filter((m) => !ctx.seenKeys.has(mediaKeyOf(m)));
  return applyMoodFilters(unseen, filters)
    .map(({ media, boostMatches }) => {
      const key = mediaKeyOf(media);
      const tenths = predictTenths(ctx.taste, media, key, noise);
      return { media, key, tenths, score: tenths + BOOST_WEIGHT_TENTHS * boostMatches };
    })
    .sort((a, b) => b.score - a.score || a.media.id - b.media.id);
}

/** Mazo de grupo (solo peliculas): boostMatches desc, luego hash32(code|key) asc; sin vistos de nadie. */
export function buildGroupDeckMedia(input: {
  code: string;
  filters: MoodFilters;
  excludeKeys: ReadonlySet<MediaKey>;
  count: number;
  catalog?: ReadonlyArray<Media>;
}): Movie[] {
  const catalog = input.catalog ?? CATALOG;
  const pool = catalog.filter(
    (m): m is Movie => m.media_type === 'movie' && !input.excludeKeys.has(mediaKeyOf(m)),
  );
  return applyMoodFilters(pool, input.filters)
    .map(({ media, boostMatches }) => ({
      media,
      boostMatches,
      h: hash32(input.code + '|' + mediaKeyOf(media)),
    }))
    .sort((a, b) => b.boostMatches - a.boostMatches || a.h - b.h)
    .slice(0, input.count)
    .map((r) => r.media as Movie);
}
