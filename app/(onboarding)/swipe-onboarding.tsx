import { StyleSheet, Text, View } from 'react-native';
import { SwipeDeck } from '@/components/features/SwipeDeck';
import { ErrorState, ProgressBar, Screen, Skeleton } from '@/components/ui';
import { useOnboardingSwipe } from '@/features/onboarding/useOnboardingSwipe';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';

export default function SwipeOnboardingScreen() {
  const { status, cards, decided, total, decide, retry } = useOnboardingSwipe();
  const counter = Math.min(decided + 1, total);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.bar}>
          <ProgressBar value={decided} max={total} />
        </View>
        <Text
          accessibilityLabel={`Película ${counter} de ${total}`}
          style={textStyle('body', { fontWeight: '800', color: COLORS.textPrimary })}
        >
          {`${counter}/${total}`}
        </Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.loading} accessibilityLabel="Cargando películas">
          <Skeleton width={270} height={405} radius={16} />
          <Skeleton width={180} height={24} />
          <Skeleton width={120} height={16} />
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.center}>
          <ErrorState message="No pudimos cargar las películas" onRetry={retry} />
        </View>
      ) : null}

      {status === 'ready' ? (
        <SwipeDeck
          cards={cards}
          progress={decided}
          max={total}
          onDecide={(media, dir) => decide(media, dir)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    minHeight: 44,
  },
  bar: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', gap: 12, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center' },
});
