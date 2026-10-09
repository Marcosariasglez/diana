// D2-5 (calidad): store del mood. El wizard guarda respuestas por id, avanza
// hasta el número de preguntas de la complejidad y finalize() resuelve
// resultados (listos/vacíos/error) con protección de carrera por requestId.
jest.mock('@/services', () => ({
  catalogRepository: { getMoodResults: jest.fn() },
}));
jest.mock('./rankingContext', () => ({ getRankingContext: () => ({}) }));
jest.mock('./useProfileStore', () => ({
  useProfileStore: { getState: () => ({ profile: { favoritePlatforms: ['netflix'] } }) },
}));

import { getQuestionsFor } from '@/features/mood/questions';
import { catalogRepository } from '@/services';
import { useMoodStore } from './useMoodStore';

const mockGetMoodResults = catalogRepository.getMoodResults as jest.Mock;

const RESULT = { media: { id: 1, media_type: 'movie', title: 'X' }, score: 0.5 };

describe('useMoodStore (D2-5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMoodResults.mockResolvedValue([RESULT]);
    useMoodStore.setState({
      mode: 'solo',
      complexity: 'intermedio',
      currentQuestionIndex: 0,
      answers: {},
      results: [],
      resultsStatus: 'idle',
    });
  });

  it('startWizard resetea respuestas/índice/resultados pero conserva complejidad', () => {
    useMoodStore.getState().answerQuestion('time', 'a');
    useMoodStore.getState().setComplexity('cinefilo');
    useMoodStore.getState().startWizard();
    const s = useMoodStore.getState();
    expect(s.answers).toEqual({});
    expect(s.currentQuestionIndex).toBe(0);
    expect(s.results).toEqual([]);
    expect(s.resultsStatus).toBe('idle');
    expect(s.complexity).toBe('cinefilo');
  });

  it('answerQuestion guarda la respuesta y avanza el índice (tope = nº de preguntas de la complejidad)', () => {
    const n = getQuestionsFor('intermedio').length;
    useMoodStore.getState().answerQuestion('time', 'b');
    expect(useMoodStore.getState().answers).toEqual({ time: 'b' });
    expect(useMoodStore.getState().currentQuestionIndex).toBe(1);
    for (let i = 0; i < n + 5; i++) useMoodStore.getState().answerQuestion('q' + i, 'x');
    expect(useMoodStore.getState().currentQuestionIndex).toBe(n);
  });

  it('finalize con resultados: status ready y envía respuestas+plataformas', async () => {
    useMoodStore.getState().answerQuestion('time', 'a');
    await useMoodStore.getState().finalize();
    const s = useMoodStore.getState();
    expect(s.resultsStatus).toBe('ready');
    expect(s.results).toHaveLength(1);
    expect(mockGetMoodResults).toHaveBeenCalledWith(
      { answers: { time: 'a' }, complexity: 'intermedio', platforms: ['netflix'] },
      expect.anything(),
    );
  });

  it('finalize sin resultados: status empty', async () => {
    mockGetMoodResults.mockResolvedValue([]);
    await useMoodStore.getState().finalize();
    expect(useMoodStore.getState().resultsStatus).toBe('empty');
  });

  it('finalize con error: status error', async () => {
    mockGetMoodResults.mockRejectedValue(new Error('boom'));
    await useMoodStore.getState().finalize();
    expect(useMoodStore.getState().resultsStatus).toBe('error');
  });

  it('carrera: un finalize lento no pisa el resultado de uno posterior', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    const first = new Promise((r) => {
      resolveFirst = r;
    });
    mockGetMoodResults.mockReturnValueOnce(first);
    mockGetMoodResults.mockResolvedValueOnce([RESULT]);

    const p1 = useMoodStore.getState().finalize();
    const p2 = useMoodStore.getState().finalize();
    await p2;
    // El segundo ya está listo...
    expect(useMoodStore.getState().resultsStatus).toBe('ready');
    // ...y cuando llega el primero (obsoleto) NO debe tocar el estado.
    resolveFirst([]);
    await p1;
    expect(useMoodStore.getState().resultsStatus).toBe('ready');
    expect(useMoodStore.getState().results).toHaveLength(1);
  });

  it('reset limpia resultados y respuestas pero conserva mode/complexity', async () => {
    mockGetMoodResults.mockResolvedValue([RESULT]);
    await useMoodStore.getState().finalize();
    useMoodStore.getState().setMode('group');
    useMoodStore.getState().setComplexity('express');
    useMoodStore.getState().reset();
    const s = useMoodStore.getState();
    expect(s.results).toEqual([]);
    expect(s.answers).toEqual({});
    expect(s.resultsStatus).toBe('idle');
    expect(s.mode).toBe('group');
    expect(s.complexity).toBe('express');
  });
});
