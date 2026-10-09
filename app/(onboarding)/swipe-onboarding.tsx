import { StyleSheet, Text, View } from 'react-native';
import { SwipeDeck } from '@/components/features/SwipeDeck';
import { ErrorState, ProgressBar, Screen, Skeleton } from '@/components/ui';
import { useOnboardingSwipe } from '@/features/onboarding/useOnboardingSwipe';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

export default function SwipeOnboardingScreen() {
  const { status, cards, decided, total, popularOnPlatforms, decide, retry } = useOnboardingSwipe();
  const { colors } = useTheme();
  const counter = Math.min(decided + 1, total);
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      minHeight: 44,
    },
    bar: { flex: 1 },
    loading: { flex: 1, alignItems: 'center' as const, gap: 12, paddingTop: 8 },
    center: { flex: 1, justifyContent: 'center' as const },
    inkText: { color: c.ink },
    coldLabel: {
      position: 'absolute' as const,
      top: 64,
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.card,
    },
  }));

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.bar}>
          <ProgressBar value={decided} max={total} />
        </View>
        <Text
          accessibilityLabel={`Película ${counter} de ${total}`}
          style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold' }), styles.inkText]}
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

      {/* D2-2.5: arranque en frio con 0 valoraciones -> el mazo es popular en
          las plataformas del usuario. */}
      {status === 'ready' && popularOnPlatforms ? (
        <Text accessibilityRole="header" style={[textStyle('bodySmall', { fontFamily: 'Manrope-SemiBold', color: colors.ink }), styles.coldLabel]}>
          {'Populares en tus plataformas'}
        </Text>
      ) : null}
    </Screen>
  );
}

