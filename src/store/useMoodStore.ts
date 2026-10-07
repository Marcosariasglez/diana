import { create } from 'zustand';
import type { MediaWithAffinity } from '@/types/media';
import type { Complexity } from '@/types/mood';
import { getQuestionsFor } from '@/features/mood/questions';
import { catalogRepository } from '@/services';
import { getRankingContext } from './rankingContext';
import { useProfileStore } from './useProfileStore';

export type MoodMode = 'solo' | 'group';

export interface MoodState {
  mode: MoodMode;
  complexity: Complexity;
  /** 0..N: N (numero de preguntas) significa que ya se respondieron todas. */
  currentQuestionIndex: number;
  answers: Record<string, string>;
  results: MediaWithAffinity[];
  resultsStatus: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  setMode: (m: MoodMode) => void;
  setComplexity: (c: Complexity) => void;
  startWizard: () => void;
  /** Guarda la respuesta y avanza currentQuestionIndex (maximo N). Plataformas: ids separados por coma. */
  answerQuestion: (questionId: string, answerId: string) => void;
  finalize: () => Promise<void>;
  /** Limpia respuestas y resultados; conserva mode y complexity (para "Repetir mood"). */
  reset: () => void;
}

const WIZARD_INITIAL = {
  currentQuestionIndex: 0,
  answers: {} as Record<string, string>,
  results: [] as MediaWithAffinity[],
  resultsStatus: 'idle' as const,
};

let requestId = 0;

export const useMoodStore = create<MoodState>()((set, get) => ({
  mode: 'solo',
  complexity: 'intermedio',
  ...WIZARD_INITIAL,
  setMode: (mode) => set({ mode }),
  setComplexity: (complexity) => set({ complexity }),
  startWizard: () => {
    requestId++;
    set({ ...WIZARD_INITIAL });
  },
  answerQuestion: (questionId, answerId) =>
    set((s) => ({
      answers: { ...s.answers, [questionId]: answerId },
      currentQuestionIndex: Math.min(s.currentQuestionIndex + 1, getQuestionsFor(s.complexity).length),
    })),
  finalize: async () => {
    const id = ++requestId;
    set({ resultsStatus: 'loading', results: [] });
    try {
      const { answers, complexity } = get();
      const platforms = useProfileStore.getState().profile.favoritePlatforms;
      const results = await catalogRepository.getMoodResults(
        { answers, complexity, platforms },
        getRankingContext(),
      );
      if (id !== requestId) return;
      set({ results, resultsStatus: results.length === 0 ? 'empty' : 'ready' });
    } catch {
      if (id === requestId) set({ resultsStatus: 'error' });
    }
  },
  reset: () => {
    requestId++;
    set({ ...WIZARD_INITIAL });
  },
}));
