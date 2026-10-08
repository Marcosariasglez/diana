import { ROUTES, roomPathForPhase } from '@/constants/routes';
import { createDefaultProfile, useProfileStore } from './useProfileStore';
import { useFeedStore } from './useFeedStore';
import { useHistoryStore } from './useHistoryStore';
import { useMoodStore } from './useMoodStore';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

beforeEach(() => {
  useProfileStore.setState({ profile: createDefaultProfile() });
  useHistoryStore.setState({ entries: [], watched: [] });
  useFeedStore.getState().reset();
  useMoodStore.getState().reset();
});

describe('useFeedStore', () => {
  it('loadFirstPage carga destacado y categorias sin nota numerica', async () => {
    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();
    expect(s.status).toBe('ready');
    expect(s.featured).not.toBeNull();
    expect(s.categories.length).toBeGreaterThan(0);
    expect(['alto', 'medio', 'bajo']).toContain(s.featured?.bucket);
    expect(s.featured).not.toHaveProperty('tenths');
  });

  it('el destacado no se repite en Recomendaciones y el feed lee las plataformas del perfil', async () => {
    await useFeedStore.getState().loadFirstPage();
    const s = useFeedStore.getState();
    const recs = s.categories.find((c) => c.id === 'recommendations');
    expect(recs?.media.some((m) => m.media.id === s.featured?.media.id && m.media.media_type === s.featured?.media.media_type)).toBe(
      false,
    );
    const platforms = useProfileStore.getState().profile.favoritePlatforms;
    for (const c of s.categories)
      for (const m of c.media) expect(m.media.platforms.some((p) => platforms.includes(p))).toBe(true);
  });

  it('loadNextPage anade la pagina siguiente sin duplicar y reset vuelve a idle', async () => {
    useProfileStore.getState().setFavoritePlatforms(['netflix', 'prime-video', 'max', 'disney-plus']);
    await useFeedStore.getState().loadFirstPage();
    const before = useFeedStore.getState();
    expect(before.hasMore).toBe(true);
    const count = (st: typeof before) => st.categories.reduce((n, c) => n + c.media.length, 0);
    await useFeedStore.getState().loadNextPage();
    const after = useFeedStore.getState();
    expect(after.page).toBe(1);
    expect(count(after)).toBeGreaterThan(count(before));
    for (const c of after.categories) {
      const keys = c.media.map((m) => `${m.media.media_type}:${m.media.id}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    useFeedStore.getState().reset();
    expect(useFeedStore.getState()).toMatchObject({ status: 'idle', featured: null, categories: [], page: 0 });
  });

  it('sin plataformas no hay destacado ni categorias', async () => {
    useProfileStore.getState().setFavoritePlatforms([]);
    await useFeedStore.getState().loadFirstPage();
    expect(useFeedStore.getState().featured).toBeNull();
    expect(useFeedStore.getState().categories).toEqual([]);
  });
});

describe('useMoodStore', () => {
  it('valores iniciales: solo, intermedio', () => {
    expect(useMoodStore.getState()).toMatchObject({
      mode: 'solo',
      complexity: 'intermedio',
      currentQuestionIndex: 0,
      answers: {},
      resultsStatus: 'idle',
    });
  });

  it('answerQuestion guarda y avanza hasta N; finalize devuelve resultados', async () => {
    const mood = useMoodStore.getState();
    mood.setComplexity('express');
    mood.startWizard();
    mood.answerQuestion('time', 'h2');
    mood.answerQuestion('energy', 'calm');
    mood.answerQuestion('energy', 'calm');
    expect(useMoodStore.getState().currentQuestionIndex).toBe(2);
    expect(useMoodStore.getState().answers).toEqual({ time: 'h2', energy: 'calm' });
    const pending = useMoodStore.getState().finalize();
    expect(useMoodStore.getState().resultsStatus).toBe('loading');
    await pending;
    const s = useMoodStore.getState();
    expect(['ready', 'empty']).toContain(s.resultsStatus);
    expect(s.results.length > 0).toBe(s.resultsStatus === 'ready');
  });

  it('finalize con las 4 respuestas de Intermedio termina en ready o empty', async () => {
    useProfileStore.getState().setFavoritePlatforms(['disney-plus']);
    const mood = useMoodStore.getState();
    mood.answerQuestion('time', 'lt90');
    mood.answerQuestion('energy', 'intense');
    mood.answerQuestion('company', 'solo');
    mood.answerQuestion('platforms', 'max');
    await useMoodStore.getState().finalize();
    expect(['ready', 'empty']).toContain(useMoodStore.getState().resultsStatus);
  });

  it('reset conserva mode y complexity pero limpia el wizard', () => {
    const mood = useMoodStore.getState();
    mood.setMode('group');
    mood.setComplexity('cinefilo');
    mood.answerQuestion('time', 'h2');
    useMoodStore.getState().reset();
    expect(useMoodStore.getState()).toMatchObject({ mode: 'group', complexity: 'cinefilo', answers: {}, currentQuestionIndex: 0 });
    useMoodStore.setState({ mode: 'solo', complexity: 'intermedio' });
  });
});

describe('manifiesto de rutas (5.1)', () => {
  it('lista las 18 filas y solo 5 con bottom nav (4 pestañas y la Ficha)', () => {
    expect(ROUTES).toHaveLength(19);
    expect(ROUTES.filter((r) => r.bottomNav).map((r) => r.url)).toEqual([
      '/',
      '/mood',
      '/match',
      '/profile',
      '/detail/[id]',
    ]);
  });

  it('urls y archivos unicos; cada archivo cuelga de app/', () => {
    expect(new Set(ROUTES.map((r) => r.url)).size).toBe(ROUTES.length);
    expect(new Set(ROUTES.map((r) => r.file)).size).toBe(ROUTES.length);
    for (const r of ROUTES) expect(r.file.startsWith('app/')).toBe(true);
  });

  it('roomPathForPhase', () => {
    expect(roomPathForPhase('X49B', 'lobby')).toBe('/room/X49B');
    expect(roomPathForPhase('X49B', 'mood')).toBe('/room/X49B/mood');
    expect(roomPathForPhase('X49B', 'swipe')).toBe('/room/X49B/swipe');
  });
});
