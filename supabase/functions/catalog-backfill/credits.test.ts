import { MAX_DIRECTORS, creditsFromResponse } from './credits';

describe('creditsFromResponse — películas (/movie/{id}/credits)', () => {
  it('toma los Director del crew y los 5 primeros del reparto', () => {
    const out = creditsFromResponse('movie', {
      crew: [
        { job: 'Producer', name: 'Una Productora' },
        { job: 'Director', name: 'Denis Villeneuve' },
      ],
      cast: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name) => ({ name })),
    });
    expect(out).toEqual({ directors: ['Denis Villeneuve'], cast_top: ['A', 'B', 'C', 'D', 'E'] });
  });

  it('quita duplicados, nombres vacíos y espacios', () => {
    const out = creditsFromResponse('movie', {
      crew: [
        { job: 'Director', name: ' Lana Wachowski ' },
        { job: 'Director', name: 'Lana Wachowski' },
        { job: 'Director', name: '' },
        { job: 'Director' },
      ],
      cast: [{ name: 'Keanu Reeves' }, { name: 'Keanu Reeves' }, { name: '' }],
    });
    expect(out).toEqual({ directors: ['Lana Wachowski'], cast_top: ['Keanu Reeves'] });
  });

  it('limita a MAX_DIRECTORS', () => {
    const crew = Array.from({ length: 10 }, (_, i) => ({ job: 'Director', name: `D${i}` }));
    expect(creditsFromResponse('movie', { crew, cast: [] }).directors).toHaveLength(MAX_DIRECTORS);
  });

  it('una respuesta sin crew ni cast da listas vacías', () => {
    expect(creditsFromResponse('movie', {})).toEqual({ directors: [], cast_top: [] });
    expect(creditsFromResponse('movie', { crew: null, cast: 'x' })).toEqual({ directors: [], cast_top: [] });
  });
});

describe('creditsFromResponse — series (/tv/{id}/aggregate_credits)', () => {
  // En aggregate_credits el puesto NO está en `job`: va en `jobs: [{ job, episode_count }]`.
  const crew = [
    { name: 'Ana', jobs: [{ job: 'Director', episode_count: 3 }, { job: 'Producer', episode_count: 8 }] },
    { name: 'Beto', jobs: [{ job: 'Director', episode_count: 10 }] },
    { name: 'Carla', jobs: [{ job: 'Writer', episode_count: 9 }] },
    { name: 'Dani', jobs: [{ job: 'Director', episode_count: 3 }] },
  ];

  it('reconoce a los directores por `jobs` y los ordena por episodios dirigidos', () => {
    const out = creditsFromResponse('tv', { crew, cast: [{ name: 'Actor 1' }] });
    expect(out.directors).toEqual(['Beto', 'Ana', 'Dani']);
    expect(out.cast_top).toEqual(['Actor 1']);
  });

  it('ignora a quien no dirigió ningún episodio', () => {
    expect(creditsFromResponse('tv', { crew: [crew[2]], cast: [] }).directors).toEqual([]);
  });

  it('también acepta el formato simple `job` por si TMDB lo devuelve', () => {
    expect(creditsFromResponse('tv', { crew: [{ job: 'Director', name: 'Eva' }], cast: [] }).directors).toEqual(['Eva']);
  });
});
