import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DoorOpen } from 'lucide-react-native';
import { EmptyState, Screen, Skeleton, useToast } from '@/components/ui';
import { RoomLobby } from '@/features/room/RoomLobby';
import { useRoomState } from '@/features/room/useRoomState';
import { useRoomStore } from '@/store/useRoomStore';
import { confirmDialog } from '@/utils/confirmDialog';

export default function LobbyScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ code: string }>();
  const routeCode = String(params.code ?? '').toUpperCase();
  const room = useRoomState({ code: routeCode });
  const [starting, setStarting] = useState(false);

  const exit = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/match');
  };

  const onBack = () =>
    confirmDialog({
      title: '¿Salir de la sala?',
      confirmLabel: 'Salir',
      onConfirm: () => {
        useRoomStore.getState().leaveRoom();
        exit();
      },
    });

  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await room.startMatch();
    } catch {
      toast.show('No se pudo comenzar el Match');
    } finally {
      setStarting(false);
    }
  };

  const failed = room.status === 'error' || (room.status === 'idle' && room.code === null && room.error !== null);
  const ready = room.status === 'active' && room.code === routeCode;

  return (
    <Screen>
      {ready ? (
        <RoomLobby
          code={routeCode}
          members={room.members}
          hostId={room.hostId}
          currentUserId={room.currentUserId}
          allReady={room.allReady}
          starting={starting}
          onStart={onStart}
          onToggleReady={room.setReady}
          onBack={onBack}
        />
      ) : failed ? (
        <EmptyState
          icon={DoorOpen}
          title={room.error === 'full' ? 'La sala está llena' : 'No encontramos esa sala'}
          action={{ label: 'Volver', onPress: exit }}
        />
      ) : (
        <View style={styles.loading} accessibilityLabel="Entrando a la sala">
          <Skeleton width="100%" height={160} radius={20} />
          <Skeleton width="100%" height={140} radius={20} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { padding: 20, gap: 14 },
});
