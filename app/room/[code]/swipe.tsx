import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Film, X } from 'lucide-react-native';
import { mediaMeta, mediaTitle } from '@/components/features/mediaHelpers';
import { Poster } from '@/components/features/Poster';
import { SwipeDeck } from '@/components/features/SwipeDeck';
import { Button, EmptyState, ErrorState, ProgressBar, Screen, Skeleton } from '@/components/ui';
import { formatGroupLikes } from '@/features/room/groupRanking';
import { useGroupSwipe } from '@/features/room/useGroupSwipe';
import { useRoomState } from '@/features/room/useRoomState';
import { useRoomStore } from '@/store/useRoomStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import { confirmDialog } from '@/utils/confirmDialog';

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export default function GroupSwipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const room = useRoomState({ code: String(params.code ?? '').toUpperCase() });
  const swipe = useGroupSwipe();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, paddingHorizontal: 20, paddingTop: 12 },
    close: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    progress: { flex: 1 },
    loading: { alignItems: 'center' as const, paddingTop: 32 },
    center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 14, paddingHorizontal: 24 },
    waitText: { textAlign: 'center' as const },
    rankingScroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 14 },
    rankingTitle: { color: c.ink, marginBottom: 6 },
    rankRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 14,
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 12,
    },
    rankInfo: { flex: 1, gap: 4 },
    actions: { gap: 12, marginTop: 16 },
  }));

  const leave = () => {
    useRoomStore.getState().leaveRoom();
    router.replace('/match');
  };
  const confirmLeave = () =>
    confirmDialog({ title: '¿Salir de la sala?', confirmLabel: 'Salir', onConfirm: leave });
  const backToRoom = () => {
    void room.backToLobby();
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={confirmLeave}
        accessibilityRole="button"
        accessibilityLabel="Salir de la sala"
        style={[styles.close, SHADOWS.card]}
      >
        <X size={20} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <View style={styles.progress}>
        <ProgressBar value={swipe.index} max={Math.max(swipe.total, 1)} />
      </View>
    </View>
  );

  if (swipe.status === 'loading') {
    return (
      <Screen>
        {header}
        <View style={styles.loading} accessibilityLabel="Cargando el mazo del grupo">
          <Skeleton width={270} height={405} radius={20} />
        </View>
      </Screen>
    );
  }

  if (swipe.status === 'error') {
    return (
      <Screen>
        {header}
        <ErrorState message="No pudimos cargar el mazo del grupo" onRetry={swipe.retry} />
      </Screen>
    );
  }

  if (swipe.status === 'empty') {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState
            icon={Film}
            title="Ningún título encaja con los filtros del grupo"
            message={room.isHost ? 'Puedes crear otra sala con filtros distintos.' : undefined}
            action={{ label: 'Salir de la sala', onPress: leave }}
          />
        </View>
      </Screen>
    );
  }

  if (swipe.isComplete && swipe.ranking) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.rankingScroll} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.rankingTitle]}>
            Lo que más gustó
          </Text>
          {swipe.ranking.length === 0 ? (
            <Text style={textStyle('body', { color: colors.textSecondary })}>
              Nadie coincidió en ningún título.
            </Text>
          ) : (
            swipe.ranking.map((item, i) => (
              <View
                key={item.key}
                accessible
                accessibilityLabel={`${i + 1}. ${mediaTitle(item.media)}. ${formatGroupLikes(item)}`}
                style={[styles.rankRow, SHADOWS.card]}
              >
                <Text style={textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 20, color: colors.acc })}>
                  {i + 1}
                </Text>
                <Poster media={item.media} size="small" />
                <View style={styles.rankInfo}>
                  <Text
                    numberOfLines={2}
                    style={textStyle('body', { fontFamily: 'Manrope-Bold', color: colors.ink })}
                  >
                    {mediaTitle(item.media)}
                  </Text>
                  <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
                    {mediaMeta(item.media)}
                  </Text>
                  <Text style={textStyle('bodySmall', { fontFamily: 'Inter-Bold', color: colors.acc })}>
                    {formatGroupLikes(item)}
                  </Text>
                </View>
              </View>
            ))
          )}
          <View style={styles.actions}>
            <Button label="Volver a la sala" onPress={backToRoom} />
            <Button label="Salir" variant="secondary" onPress={leave} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (swipe.finished) {
    const names = swipe.waitingNames;
    return (
      <Screen>
        {header}
        <View style={styles.center} accessibilityLiveRegion="polite">
          <Text style={[textStyle('body', { fontFamily: 'Manrope-Bold', color: colors.ink }), styles.waitText]}>
            {names.length > 0 ? `Esperando a ${joinNames(names)}...` : 'Esperando al grupo...'}
          </Text>
          <Skeleton width={200} height={16} radius={8} />
          <Skeleton width={140} height={16} radius={8} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <SwipeDeck
        cards={swipe.deck.slice(swipe.index)}
        onDecide={(_media, dir) => {
          if (dir === 'like' || dir === 'skip') swipe.decide(dir);
        }}
        progress={swipe.index}
        max={swipe.total}
        allowUnseen={false}
      />
    </Screen>
  );
}

