// D2-2.6: interruptor del recomendador EXPO_PUBLIC_RECOMMENDER (defecto 'heuristic').
// El módulo lee process.env al importarse: se usa jest.isolateModules por caso
// con las variables fijadas explícitamente (no depende de .env.local).
describe('env: EXPO_PUBLIC_RECOMMENDER (D2-2.6)', () => {
  const KEYS = ['EXPO_PUBLIC_RECOMMENDER', 'EXPO_PUBLIC_BACKEND', 'EXPO_PUBLIC_CATALOG'] as const;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterAll(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function loadEnv(): { RECOMMENDER: string; BACKEND: string; CATALOG: string } {
    let mod: { RECOMMENDER: string; BACKEND: string; CATALOG: string } | undefined;
    jest.isolateModules(() => {
      mod = require('@/lib/env');
    });
    if (!mod) throw new Error('env no cargado');
    return mod;
  }

  it('por defecto es heuristic cuando la variable no existe', () => {
    expect(loadEnv().RECOMMENDER).toBe('heuristic');
  });

  it('acepta "content"', () => {
    process.env.EXPO_PUBLIC_RECOMMENDER = 'content';
    expect(loadEnv().RECOMMENDER).toBe('content');
  });

  it('cualquier otro valor cae a heuristic (defecto seguro)', () => {
    process.env.EXPO_PUBLIC_RECOMMENDER = 'otro-valor';
    expect(loadEnv().RECOMMENDER).toBe('heuristic');
  });

  it('BACKEND y CATALOG se parsean de sus variables', () => {
    process.env.EXPO_PUBLIC_BACKEND = 'supabase';
    process.env.EXPO_PUBLIC_CATALOG = 'tmdb';
    const env = loadEnv();
    expect(env.BACKEND).toBe('supabase');
    expect(env.CATALOG).toBe('tmdb');
  });

  it('CATALOG=tmdb sin BACKEND=supabase lanza (invariante D2-1)', () => {
    process.env.EXPO_PUBLIC_CATALOG = 'tmdb';
    expect(() => loadEnv()).toThrow('EXPO_PUBLIC_CATALOG=tmdb exige EXPO_PUBLIC_BACKEND=supabase');
  });
});
