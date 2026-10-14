/// <reference types="jest" />
/**
 * B1: Auditoría automática de filtros de mood.
 *
 * Construye un catálogo sintético que cubre los límites de cada filtro y verifica
 * que cada opción de cada pregunta respeta el contrato especificado en el plan
 * (plan-ajustes-oct13.md, bloque B).
 *
 * Este test debe fallar ANTES de aplicar B2/B3 (reproduce el bug del dueño).
 */
import type { MoodFilters } from '@/types/mood';
import { applyMoodFilters } from '../moodFilters';
import { synthMovie } from './helpers';
import type { Media, TVSeries } from '@/types/media';
import { genresFromIds } from '@/mocks/data/genres';

const f = (answers: Record<string, string>, fallbackPlatforms: string[] = []): MoodFilters => ({
  answers,
  fallbackPlatforms,
});

const ids = (r: Array<{ media: Media }>) => r.map((x) => x.media.id);

function synthTv(id: number, genreIds: number[], extra: Partial<TVSeries> = {}): TVSeries {
  return {
    id,
    media_type: 'tv',
    name: `Serie ${id}`,
    first_air_date: '2020-01-01',
    episode_run_time: [45],
    seasons: [],
    poster_path: null,
    backdrop_path: null,
    genres: genresFromIds(genreIds),
    overview: '',
    vote_average: 7,
    vote_count: 100,
    popularity: 10,
    platforms: ['netflix'],
    alt_titles: [],
    ...extra,
  };
}

// Catálogo sintético que cubre los límites de cada filtro
const pool: Media[] = [
  // Runtime: límites de duración
  synthMovie(1, [18], { runtime: 0, release_date: '2020-01-01' }), // desconocida
  synthMovie(2, [18], { runtime: 45, release_date: '2020-01-01' }), // muy corta
  synthMovie(3, [18], { runtime: 85, release_date: '2020-01-01' }), // < 90
  synthMovie(4, [18], { runtime: 89, release_date: '2020-01-01' }), // límite lt90
  synthMovie(5, [18], { runtime: 90, release_date: '2020-01-01' }), // límite h2
  synthMovie(6, [18], { runtime: 100, release_date: '2020-01-01' }), // normal
  synthMovie(7, [18], { runtime: 130, release_date: '2020-01-01' }), // larga normal
  synthMovie(8, [18], { runtime: 150, release_date: '2020-01-01' }), // límite h2
  synthMovie(9, [18], { runtime: 151, release_date: '2020-01-01' }), // límite marathon
  synthMovie(10, [18], { runtime: 170, release_date: '2020-01-01' }), // marathon
  synthMovie(11, [18], { runtime: 30, release_date: '2020-01-01' }), // corto real

  // Era: límites de año
  synthMovie(12, [18], { runtime: 100, release_date: '1999-12-31' }), // límite classic
  synthMovie(13, [18], { runtime: 100, release_date: '2000-01-01' }), // límite modern
  synthMovie(14, [18], { runtime: 100, release_date: '2019-12-31' }), // límite modern
  synthMovie(15, [18], { runtime: 100, release_date: '2020-01-01' }), // límite new
  synthMovie(16, [18], { runtime: 100, release_date: '1985-01-01' }), // clásico
  synthMovie(17, [18], { runtime: 100, release_date: '2023-01-01' }), // nuevo

  // Año desconocido
  synthMovie(18, [18], { runtime: 100, release_date: '0000-01-01' }), // año 0

  // Plataformas
  synthMovie(19, [18], { runtime: 100, platforms: ['netflix'] }),
  synthMovie(20, [18], { runtime: 100, platforms: ['prime-video'] }),
  synthMovie(21, [18], { runtime: 100, platforms: ['max', 'disney-plus'] }),
  synthMovie(22, [18], { runtime: 100, platforms: [] }), // sin plataforma

  // Series
  synthTv(100, [18], { platforms: ['netflix'] }),
  synthTv(101, [18], { platforms: ['prime-video'] }),

  // Generos para boost
  synthMovie(200, [28], { runtime: 100, platforms: ['netflix'] }), // acción
  synthMovie(201, [53], { runtime: 100, platforms: ['netflix'] }), // suspense
  synthMovie(202, [18], { runtime: 100, platforms: ['netflix'] }), // drama
  synthMovie(203, [35], { runtime: 100, platforms: ['netflix'] }), // comedia
];

describe('B1: auditoría de filtros de mood', () => {
  // ---- tiempo ----
  describe('time = lt90', () => {
    const result = ids(applyMoodFilters(pool, f({ time: 'lt90' })));
    it('solo películas con 0 < runtime < 90', () => {
      expect(result.sort()).toEqual([2, 3, 4, 11].sort());
    });
    it('NO incluye runtime = 90', () => {
      expect(result).not.toContain(5);
    });
    it('NO incluye runtime = 0 (desconocida)', () => {
      expect(result).not.toContain(1);
    });
    it('NO incluye series', () => {
      expect(result).not.toContain(100);
    });
  });

  describe('time = h2', () => {
    const result = ids(applyMoodFilters(pool, f({ time: 'h2' }, [])));
    it('solo películas con 90 <= runtime <= 150', () => {
      const expected = pool
        .filter((m): m is Media => m.media_type === 'movie' && m.runtime >= 90 && m.runtime <= 150)
        .map((m) => m.id);
      expect(result.sort()).toEqual(expected.sort());
    });
    it('NO incluye runtime < 90', () => {
      expect(result).not.toContain(4);
    });
    it('NO incluye runtime > 150', () => {
      expect(result).not.toContain(9);
    });
  });

  describe('time = marathon', () => {
    const result = ids(applyMoodFilters(pool, f({ time: 'marathon' })));
    it('solo películas con runtime > 150', () => {
      expect(result.sort()).toEqual([9, 10].sort());
    });
    it('NO incluye runtime = 150', () => {
      expect(result).not.toContain(8);
    });
  });

  describe('time = series', () => {
    const result = ids(applyMoodFilters(pool, f({ time: 'series' })));
    it('solo series', () => {
      expect(result.sort()).toEqual([100, 101].sort());
    });
    it('NO incluye películas', () => {
      expect(result).not.toContain(1);
    });
  });

  // ---- era ----
  describe('era = classic', () => {
    const result = ids(applyMoodFilters(pool, f({ era: 'classic' })));
    it('solo películas con 1 <= year <= 1999', () => {
      expect(result).toContain(12);
      expect(result).toContain(16);
    });
    it('NO incluye año = 0 (desconocido)', () => {
      expect(result).not.toContain(18);
    });
    it('NO incluye año >= 2000', () => {
      expect(result).not.toContain(13);
    });
  });

  describe('era = modern', () => {
    const result = ids(applyMoodFilters(pool, f({ era: 'modern' })));
    it('solo películas con 2000 <= year <= 2019', () => {
      expect(result).toContain(13);
      expect(result).toContain(14);
    });
    it('NO incluye año = 0 (desconocido)', () => {
      expect(result).not.toContain(18);
    });
    it('NO incluye año >= 2020', () => {
      expect(result).not.toContain(15);
    });
  });

  describe('era = new', () => {
    const result = ids(applyMoodFilters(pool, f({ era: 'new' })));
    it('solo películas con year >= 2020', () => {
      expect(result).toContain(15);
      expect(result).toContain(17);
    });
    it('NO incluye año = 0 (desconocido)', () => {
      expect(result).not.toContain(18);
    });
    it('NO incluye año < 2020', () => {
      expect(result).not.toContain(14);
    });
  });

  // ---- plataformas ----
  describe('platforms = netflix', () => {
    const result = ids(applyMoodFilters(pool, f({ platforms: 'netflix' }, [])));
    it('solo títulos con Netflix', () => {
      expect(result).toContain(19);
      expect(result).not.toContain(20);
      expect(result).not.toContain(21);
      expect(result).not.toContain(22);
    });
  });

  describe('sin plataforma responde, usa fallback', () => {
    const result = ids(applyMoodFilters(pool, f({}, ['prime-video'])));
    it('solo títulos con Prime Video', () => {
      expect(result).toContain(20);
      expect(result).not.toContain(19);
    });
  });

  // ---- genero boost (energy/company/pace NO descartan) ----
  describe('energy = intense', () => {
    const result = applyMoodFilters(pool, f({ energy: 'intense' }));
    it('NO descarta nada (solo reordena)', () => {
      // energy/intense boosts [28, 53, 27]
      expect(result.length).toBeGreaterThan(0);
      // Las películas de acción/suspense deberían estar antes
      expect(result[0].boostMatches).toBeGreaterThanOrEqual(1);
    });
  });

  describe('company = couple', () => {
    const result = applyMoodFilters(pool, f({ company: 'couple' }));
    it('NO descarta nada (solo reordena)', () => {
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// B3: Verifica que runtime = 0 descarta (ya en B1 pero explícito)
describe('B2+B3: duración y año desconocidos', () => {
  it('runtime = 0 descarta en filtro de duración', () => {
    const result = ids(applyMoodFilters(pool, f({ time: 'h2' })));
    expect(result).not.toContain(1);
  });

  it('año = 0 descarta en filtro de era', () => {
    const result = ids(applyMoodFilters(pool, f({ era: 'modern' })));
    expect(result).not.toContain(18);
  });
});
