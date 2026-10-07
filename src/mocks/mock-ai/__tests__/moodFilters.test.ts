import { QUESTIONS, QUESTIONS_BY_COMPLEXITY, getQuestionsFor } from '@/features/mood/questions';
import type { MoodFilters } from '@/types/mood';
import { applyMoodFilters } from '../moodFilters';
import { synthMovie } from './helpers';
import type { Media, TVSeries } from '@/types/media';
import { genresFromIds } from '@/mocks/data/genres';

const f = (answers: Record<string, string>, fallbackPlatforms: string[] = ['netflix']): MoodFilters => ({
  answers,
  fallbackPlatforms,
});

const short = synthMovie(1, [18], { runtime: 85, release_date: '1985-01-01' });
const normal = synthMovie(2, [28], { runtime: 100, release_date: '2005-01-01', platforms: ['max'] });
const long = synthMovie(3, [53], { runtime: 140, release_date: '2021-01-01', platforms: ['prime-video'] });
const serie: TVSeries = {
  id: 4,
  media_type: 'tv',
  name: 'Serie',
  first_air_date: '2022-01-01',
  episode_run_time: [45],
  seasons: [],
  poster_path: null,
  backdrop_path: null,
  genres: genresFromIds([18]),
  overview: '',
  vote_average: 7,
  vote_count: 100,
  popularity: 1,
  platforms: ['netflix'],
  alt_titles: [],
};
const pool: Media[] = [short, normal, long, serie];
const ids = (r: Array<{ media: Media }>) => r.map((x) => x.media.id);

describe('applyMoodFilters', () => {
  it('M1 time = lt90 deja solo la de 85 min', () => {
    const movies = [short, synthMovie(10, [18], { runtime: 100 }), synthMovie(11, [18], { runtime: 140 })];
    expect(ids(applyMoodFilters(movies, f({ time: 'lt90' })))).toEqual([1]);
  });

  it('M2 time = series deja solo series', () => {
    expect(ids(applyMoodFilters(pool, f({ time: 'series' })))).toEqual([4]);
  });

  it('M3 era = classic deja solo anteriores a 2000', () => {
    expect(ids(applyMoodFilters(pool, f({ era: 'classic' }, [])))).toEqual([1]);
  });

  it('M4 platforms = netflix,max', () => {
    expect(ids(applyMoodFilters(pool, f({ platforms: 'netflix,max' }, []))).sort()).toEqual([1, 2, 4]);
  });

  it('M5 sin pregunta de plataformas usa fallbackPlatforms', () => {
    expect(ids(applyMoodFilters(pool, f({}, ['prime-video'])))).toEqual([3]);
  });

  it('M6 energy = intense pone Accion/Suspense/Terror antes', () => {
    const r = applyMoodFilters(pool, f({ energy: 'intense' }, []));
    expect(ids(r).slice(0, 2).sort()).toEqual([2, 3]);
    expect(r[0].boostMatches).toBe(1);
    expect(r[3].boostMatches).toBe(0);
  });

  it('M7 pregunta sin responder no filtra', () => {
    expect(applyMoodFilters(pool, f({}, [])).length).toBe(pool.length);
    expect(applyMoodFilters(pool, f({ time: '' }, [])).length).toBe(pool.length);
  });

  it('M8 QUESTIONS_BY_COMPLEXITY', () => {
    expect(QUESTIONS_BY_COMPLEXITY.express).toHaveLength(2);
    expect(QUESTIONS_BY_COMPLEXITY.intermedio).toHaveLength(4);
    expect(QUESTIONS_BY_COMPLEXITY.intermedio).toContain('platforms');
    expect(QUESTIONS_BY_COMPLEXITY.cinefilo).toHaveLength(6);
    expect(QUESTIONS_BY_COMPLEXITY.cinefilo).toContain('platforms');
    for (const list of Object.values(QUESTIONS_BY_COMPLEXITY)) {
      expect(list as string[]).not.toContain('mood');
      expect(list as string[]).not.toContain('animo');
    }
    expect(getQuestionsFor('cinefilo').map((q) => q.id)).toEqual(QUESTIONS_BY_COMPLEXITY.cinefilo);
  });

  it('M9 todas las opciones tienen icono, titulo y subtitulo', () => {
    for (const q of Object.values(QUESTIONS)) {
      expect(q.options.length).toBeGreaterThan(0);
      for (const o of q.options) {
        expect(o.icon).toBeDefined();
        expect(o.title.length).toBeGreaterThan(0);
        expect(o.subtitle.length).toBeGreaterThan(0);
      }
    }
  });
});
