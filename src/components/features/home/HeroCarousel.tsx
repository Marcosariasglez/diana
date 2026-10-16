import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useTheme } from '@/theme/ThemeProvider';
import type { FeedItem, Media } from '@/types/media';
import { HeroCard } from './HeroCard';

export interface HeroCarouselProps {
  items: FeedItem[];
  onPress: (media: Media) => void;
}

const SIDE = 20;
const GAP = 12;
const WIDE_BREAKPOINT = 768;
const WIDE_CARD_WIDTH = 520;
const MAX_HEIGHT = 440;

/** Medidas de cada tarjeta según el ancho de pantalla (2 visibles en web ancha). */
export function heroSize(screenWidth: number): { width: number; height: number } {
  const width = screenWidth >= WIDE_BREAKPOINT ? WIDE_CARD_WIDTH : screenWidth - SIDE * 2;
  return { width, height: Math.min(MAX_HEIGHT, Math.round(screenWidth * 1.15)) };
}

/** Carrusel paginado «Para ti» (hasta 5 tarjetas) con indicador de página. Sin autoplay. */
export function HeroCarousel({ items, onPress }: HeroCarouselProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useMotionPreference();
  const { width, height } = heroSize(screenWidth);
  const step = width + GAP;
  const listRef = useRef<FlatList<FeedItem>>(null);
  const [page, setPage] = useState(0);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      listRef.current?.scrollToOffset({ offset: clamped * step, animated: !reduceMotion });
      setPage(clamped);
    },
    [items.length, step, reduceMotion],
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setPage(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
    },
    [items.length, step],
  );

  const onAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'increment') goTo(page + 1);
      if (e.nativeEvent.actionName === 'decrement') goTo(page - 1);
    },
    [goTo, page],
  );

  const renderItem: ListRenderItem<FeedItem> = useCallback(
    ({ item, index }) => (
      <HeroCard item={item} index={index} total={items.length} width={width} height={height} onPress={onPress} />
    ),
    [items.length, width, height, onPress],
  );

  if (items.length === 0) return null;
  return (
    <View>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => `${it.media.media_type}-${it.media.id}`}
        snapToInterval={step}
        decelerationRate="fast"
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        onMomentumScrollEnd={onScrollEnd}
      />
      {items.length > 1 ? (
        <View
          style={styles.dots}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Para ti, ${page + 1} de ${items.length}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          testID="hero-dots"
        >
          {items.map((it, i) => (
            <View
              key={`${it.media.media_type}-${it.media.id}`}
              style={[
                styles.dot,
                i === page ? styles.dotActive : null,
                { backgroundColor: i === page ? colors.acc : colors.lineStrong },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 12, minHeight: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
});
