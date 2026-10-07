import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, useToast } from '@/components/ui';
import { GroupMoodView } from '@/features/room/GroupMoodView';
import { useGroupMood } from '@/features/room/useGroupMood';
import { useRoomState } from '@/features/room/useRoomState';
import { useRoomStore } from '@/store/useRoomStore';
import { confirmDialog } from '@/utils/confirmDialog';

export default function GroupMoodScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ code: string }>();
  useRoomState({ code: String(params.code ?? '').toUpperCase() });
  const { questions, answers, isHost, moodComplete, selectAnswer, confirm } = useGroupMood();
  const [confirming, setConfirming] = useState(false);

  const onConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await confirm();
    } catch {
      toast.show('No se pudieron confirmar los filtros');
    } finally {
      setConfirming(false);
    }
  };

  const onSelect = (questionId: string, answerId: string) => {
    selectAnswer(questionId, answerId).catch(() => toast.show('No se pudo guardar la respuesta'));
  };

  const onBack = () =>
    confirmDialog({
      title: '¿Salir de la sala?',
      confirmLabel: 'Salir',
      onConfirm: () => {
        useRoomStore.getState().leaveRoom();
        router.replace('/match');
      },
    });

  return (
    <Screen>
      <GroupMoodView
        questions={questions}
        answers={answers}
        isHost={isHost}
        moodComplete={moodComplete}
        confirming={confirming}
        onSelect={onSelect}
        onConfirm={onConfirm}
        onBack={onBack}
      />
    </Screen>
  );
}
