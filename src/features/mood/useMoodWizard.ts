import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { getQuestionsFor } from '@/features/mood/questions';
import { toggleMultiAnswer } from '@/features/room/useGroupMood';
import { useMoodStore } from '@/store/useMoodStore';
import { useProfileStore } from '@/store/useProfileStore';
import { confirmDialog } from '@/utils/confirmDialog';

/**
 * Logica del wizard de Mood personal. La pregunta mostrada (`shown`) es local: el store
 * avanza `currentQuestionIndex` al responder, pero la pantalla solo cambia de pregunta
 * cuando termina el fundido de salida (`onAdvance`). La pregunta de plataformas
 * (multiple) parte preseleccionada con `favoritePlatforms`.
 */
export function useMoodWizard() {
  const router = useRouter();
  const complexity = useMoodStore((s) => s.complexity);
  const answers = useMoodStore((s) => s.answers);
  const favoritePlatforms = useProfileStore((s) => s.profile.favoritePlatforms);
  const questions = useMemo(() => getQuestionsFor(complexity), [complexity]);
  const total = questions.length;
  const [shown, setShown] = useState(0);
  const question = questions[Math.min(shown, total - 1)];

  const selectedIds = useMemo(() => {
    const raw = answers[question.id];
    if (raw !== undefined) return raw.split(',').filter(Boolean);
    return question.id === 'platforms' ? favoritePlatforms : [];
  }, [answers, question.id, favoritePlatforms]);

  const onAnswer = useCallback(
    (answerId: string) => {
      const store = useMoodStore.getState();
      if (question.selection === 'multiple') {
        const current = store.answers[question.id] ?? favoritePlatforms.join(',');
        const next = toggleMultiAnswer(current, answerId);
        if (next === '') return; // no puede quedar vacia
        useMoodStore.setState({ answers: { ...store.answers, [question.id]: next } });
        return;
      }
      store.answerQuestion(question.id, answerId);
    },
    [question, favoritePlatforms],
  );

  const onAdvance = useCallback(() => {
    const store = useMoodStore.getState();
    if (question.selection === 'multiple') {
      // Confirma la seleccion (o la preseleccion) y deja el indice del store al final.
      store.answerQuestion(question.id, store.answers[question.id] ?? favoritePlatforms.join(','));
    }
    if (shown + 1 >= total) {
      void useMoodStore.getState().finalize();
      router.replace('/mood-results');
    } else {
      setShown(shown + 1);
    }
  }, [question, favoritePlatforms, shown, total, router]);

  const close = useCallback(() => {
    const leave = () => {
      useMoodStore.getState().reset();
      if (router.canGoBack()) router.back();
      else router.replace('/mood');
    };
    if (Object.keys(useMoodStore.getState().answers).length === 0) {
      leave();
      return;
    }
    confirmDialog({
      title: '¿Salir del Mood?',
      message: 'Perderás tus respuestas.',
      confirmLabel: 'Salir',
      onConfirm: leave,
    });
  }, [router]);

  return { question, index: shown + 1, total, selectedIds, onAnswer, onAdvance, close };
}
