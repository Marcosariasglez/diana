import { useCallback, useEffect, useMemo } from 'react';
import type { MoodAnswerOption, MoodQuestion } from '@/types/mood';
import { getQuestionsFor } from '@/features/mood/questions';
import {
  selectIsHost,
  selectMoodComplete,
  useRoomStore,
} from '@/store/useRoomStore';
import { useProfileStore } from '@/store/useProfileStore';

/** Respuesta de seleccion multiple: alterna `answerId` en la lista separada por comas. */
export function toggleMultiAnswer(current: string | undefined, answerId: string): string {
  const ids = (current ?? '').split(',').filter(Boolean);
  const next = ids.includes(answerId) ? ids.filter((i) => i !== answerId) : [...ids, answerId];
  return next.join(',');
}

/** Opciones elegidas de una pregunta (la multiple devuelve varias). */
export function selectedOptions(question: MoodQuestion, answer: string | undefined): MoodAnswerOption[] {
  if (!answer) return [];
  const ids = question.selection === 'multiple' ? answer.split(',').filter(Boolean) : [answer];
  return ids
    .map((id) => question.options.find((o) => o.id === id))
    .filter((o): o is MoodAnswerOption => o !== undefined);
}

/**
 * Mood de grupo (siempre banco Intermedio). El anfitrion responde y confirma; el resto
 * ve `answers` actualizarse en tiempo real desde el RoomSnapshot.
 */
export function useGroupMood() {
  const questions = useMemo(() => getQuestionsFor('intermedio'), []);
  const answers = useRoomStore((s) => s.mood.answers);
  const phase = useRoomStore((s) => s.phase);
  const hostId = useRoomStore((s) => s.hostId);
  const currentUserId = useProfileStore((s) => s.profile.id);
  const favoritePlatforms = useProfileStore((s) => s.profile.favoritePlatforms);
  const isHost = selectIsHost({ hostId }, currentUserId);
  const moodComplete = selectMoodComplete({ mood: { answers, confirmed: false } });

  // La pregunta de plataformas del anfitrion parte preseleccionada con el filtro global.
  const needsPlatformSeed = isHost && phase === 'mood' && !answers.platforms && favoritePlatforms.length > 0;
  useEffect(() => {
    if (!needsPlatformSeed) return;
    useRoomStore
      .getState()
      .setMoodAnswer('platforms', favoritePlatforms.join(','))
      .catch(() => {});
  }, [needsPlatformSeed, favoritePlatforms]);

  const selectAnswer = useCallback(
    async (questionId: string, answerId: string) => {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;
      const current = useRoomStore.getState().mood.answers[questionId];
      const next = question.selection === 'multiple' ? toggleMultiAnswer(current, answerId) : answerId;
      if (next === '') return; // la pregunta multiple no puede quedar vacia
      await useRoomStore.getState().setMoodAnswer(questionId, next);
    },
    [questions],
  );

  const confirm = useCallback(() => useRoomStore.getState().confirmMood(), []);

  return { questions, answers, isHost, moodComplete, selectAnswer, confirm };
}
