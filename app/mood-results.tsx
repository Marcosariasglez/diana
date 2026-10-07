import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Film, X } from 'lucide-react-native';
import { FeaturedMatchCard } from '@/components/features/FeaturedMatchCard';
import { mediaTitle } from '@/components/features/mediaHelpers';
import { PosterCarousel } from '@/components/features/PosterCarousel';
import { Button, EmptyState, ErrorState, Screen, Skeleton } from '@/components/ui';
import { useMoodStore } from '@/store/useMoodStore';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';

export default function MoodResultsScreen() {
  const router = useRouter();
  const status = useMoodStore((s) => s.resultsStatus);
  const results = useMoodStore((s) => s.results);

  const openDetail = (media: Media) =>
    router.push(`/detail/${media.id}?type=${media.media_type}` as never);
  const repeat = () => {
    useMoodStore.getState().reset();
    router.replace('/mood-wizard');
  };
  const close = () => {
    router.replace('/mood');
  };
  const retry = () => {
    void useMoodStore.getState().finalize();
  };

  const best = results[0];
  const others = results.slice(1, 6);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, SHADOWS.card]}
        >
          <X size={22} color={COLORS.textPrimary} strokeWidth={2.25} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {status === 'loading' ? (
          <View accessibilityLabel="Calculando tu mejor match..." style={styles.loading}>
            <Text style={[textStyle('body', { fontWeight: '600', color: COLORS.textSecondary }), styles.pad]}>
              Calculando tu mejor match...
            </Text>
            <View style={styles.pad}>
              <Skeleton width="100%" height={280} radius={16} />
            </View>
            <View style={[styles.pad, styles.row]}>
              <Skeleton width={120} height={180} radius={12} />
              <Skeleton width={120} height={180} radius={12} />
            </View>
          </View>
        ) : null}

        {status === 'error' ? (
          <ErrorState message="No pudimos calcular tu mejor match" onRetry={retry} />
        ) : null}

        {status === 'empty' || status === 'idle' || (status === 'ready' && !best) ? (
          <EmptyState
            icon={Film}
            title="Ningún título encaja con tu mood"
            message="Prueba con otras respuestas."
            action={{ label: 'Repetir mood', onPress: repeat }}
          />
        ) : null}

        {status === 'ready' && best ? (
          <View style={styles.content}>
            <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.pad, styles.heading]}>
              Tu mejor match
            </Text>
            <View style={styles.pad}>
              <FeaturedMatchCard item={best} onPress={() => openDetail(best.media)} />
              <Text
                accessibilityRole="header"
                style={[textStyle('bestMatch', { color: COLORS.textPrimary }), styles.bestTitle]}
              >
                {mediaTitle(best.media)}
              </Text>
            </View>
            {others.length > 0 ? (
              <View style={styles.others}>
                <PosterCarousel title="Otras opciones" items={others} onPress={openDetail} />
              </View>
            ) : null}
            <View style={styles.pad}>
              <Button label="Repetir mood" variant="secondary" onPress={repeat} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingTop: 12, paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  content: { gap: 20 },
  heading: { color: COLORS.textPrimary },
  bestTitle: { marginTop: 16 },
  others: { marginTop: 4 },
  loading: { gap: 20 },
  row: { flexDirection: 'row', gap: 12 },
});
