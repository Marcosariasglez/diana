// D2-2.6 / F4-3: interruptor del recomendador EXPO_PUBLIC_RECOMMENDER +
// chequeo obligatorio de Supabase.
// BACKEND y CATALOG eliminados en P10. La app siempre usa Supabase + TMDB.
// jest.isolateModules por caso con las variables fijadas explícitamente.
describe('env: EXPO_PUBLIC_RECOMMENDER + chequeo Supabase (D2-2.6 / F4-3)', () => {
  const KEYS = ['EXPO_PUBLIC_RECOMMENDER', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;
  const saved: Record<string, string | undefined> = {};
  beforeAll(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  beforeEach(() => {
    for (const k of KEYS) {
      delete process.env[k];
    }
  });
  afterAll(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function loadEnv(): { RECOMMENDER: string } {
    let mod: { RECOMMENDER: string } | undefined;
    jest.isolateModules(() => {
      mod = require('@/lib/env');
    });
    if (!mod) throw new Error('env no cargado');
    return mod;
  }

  it('lanza sin SUPABASE_URL y SUPABASE_ANON_KEY', () => {
    expect(() => loadEnv()).toThrow('Diana necesita Supabase: EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY son obligatorios');
  });

  it('lanza si falta solo SUPABASE_URL', () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    expect(() => loadEnv()).toThrow('Diana necesita Supabase');
  });

  it('lanza si falta solo SUPABASE_ANON_KEY', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    expect(() => loadEnv()).toThrow('Diana necesita Supabase');
  });

  it('carga correctamente con Supabase configurado', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    expect(loadEnv().RECOMMENDER).toBe('content');
  });

  it('por defecto es content cuando la variable no existe (A.6: el defecto es el ganador)', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    expect(loadEnv().RECOMMENDER).toBe('content');
  });

  it('acepta "content" explícito', () => {
    process.env.EXPO_PUBLIC_RECOMMENDER = 'content';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    expect(loadEnv().RECOMMENDER).toBe('content');
  });

  it('acepta "heuristic" como opt-out explícito', () => {
    process.env.EXPO_PUBLIC_RECOMMENDER = 'heuristic';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    expect(loadEnv().RECOMMENDER).toBe('heuristic');
  });

  it('cualquier otro valor cae al defecto content (la degradación la hace activeRecommender)', () => {
    process.env.EXPO_PUBLIC_RECOMMENDER = 'otro-valor';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    expect(loadEnv().RECOMMENDER).toBe('content');
  });
});
