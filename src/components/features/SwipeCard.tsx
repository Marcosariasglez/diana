import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/hooks/useHaptics';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { resolveDirection, type SwipeDir } from '@/features/swipe/direction';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { Media } from '@/types/media';
import { toJS } from '@/utils/worklets';
import { mediaTitle } from './mediaHelpers';
import { Poster } from './Poster';

export interface SwipeCardHandle {
  /** Ejecuta la misma animacion y decision que el gesto (botones de O2). */
  decide: (dir: SwipeDir) => void;
}

export interface SwipeCardProps {
  media: Media;
  isTop: boolean;
  onDecide: (dir: SwipeDir) => void;
  /** Por defecto true; false en swipe de grupo (gesto vertical desactivado). */
  allowUnseen?: boolean;
  ref?: Ref<SwipeCardHandle>;
}

const SPRING = { damping: 15, stiffness: 120 };
const UNSEEN_BLUE = '#2E5E7A';

export function SwipeCard({ media, isTop, onDecide, allowUnseen = true, ref }: SwipeCardProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const decided = useSharedValue(false);
  const { width } = useWindowDimensions();
  const reduced = useMotionPreference();
  const title = mediaTitle(media);

  const exitTo = (dir: SwipeDir) => {
    'worklet';
    if (decided.value) return;
    if (dir === 'unseen' && !allowUnseen) return;
    decided.value = true;
    const target =
      dir === 'like'
        ? { x: width * 1.4, y: 0 }
        : dir === 'skip'
          ? { x: -width * 1.4, y: 0 }
          : { x: 0, y: -width * 1.6 };
    const duration = reduced ? 120 : 220;
    translateX.value = withTiming(target.x, { duration });
    translateY.value = withTiming(target.y, { duration }, (finished) => {
      if (finished) toJS(onDecide)(dir);
    });
  };

  useImperativeHandle(ref, () => ({ decide: (dir: SwipeDir) => exitTo(dir) }));

  const pan = Gesture.Pan()
    .enabled(isTop)
    .minDistance(8)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotation.value = reduced
        ? 0
        : interpolate(e.translationX, [-width, 0, width], [-15, 0, 15], Extrapolation.CLAMP);
    })
    .onEnd((e) => {
      const dir = resolveDirection(e.translationX, e.translationY, e.velocityX, e.velocityY, allowUnseen);
      if (dir) {
        toJS(haptic)('light');
        exitTo(dir);
      } else {
        translateX.value = withSpring(0, SPRING);
        translateY.value = withSpring(0, SPRING);
        rotation.value = withSpring(0, SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));
  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 120], [0, 1], Extrapolation.CLAMP),
  }));
  const skipStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-120, -20], [1, 0], Extrapolation.CLAMP),
  }));
  const unseenStampStyle = useAnimatedStyle(() => ({
    opacity: allowUnseen
      ? interpolate(translateY.value, [-120, -20], [1, 0], Extrapolation.CLAMP)
      : 0,
  }));

  const onAccessibilityAction = (e: { nativeEvent: { actionName: string } }) => {
    const name = e.nativeEvent.actionName;
    if (name === 'like' || name === 'skip' || name === 'unseen') exitTo(name);
  };

  const actions = [
    { name: 'like', label: 'Me gusta' },
    { name: 'skip', label: 'Paso' },
    ...(allowUnseen ? [{ name: 'unseen', label: 'No la he visto' }] : []),
  ];

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityLabel={title}
        accessibilityActions={isTop ? actions : undefined}
        onAccessibilityAction={isTop ? onAccessibilityAction : undefined}
        style={[styles.card, cardStyle]}
      >
        <Poster media={media} size="giant" />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[styles.stamp, styles.stampLike, { borderColor: colors.acc, backgroundColor: colors.card }, likeStampStyle]}
          >
            <Text style={[styles.stampText, { color: colors.acc }]}>ME GUSTA</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.stamp,
              styles.stampSkip,
              { borderColor: colors.textSecondary, backgroundColor: colors.card },
              skipStampStyle,
            ]}
          >
            <Text style={[styles.stampText, { color: colors.textSecondary }]}>Paso</Text>
          </Animated.View>
          <Animated.View
            style={[styles.stamp, styles.stampUnseen, { borderColor: UNSEEN_BLUE, backgroundColor: colors.card }, unseenStampStyle]}
          >
            <Text style={[styles.stampText, { color: UNSEEN_BLUE }]}>No la he visto</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center' },
  stamp: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stampLike: {
    top: 28,
    left: 18,
    transform: [{ rotate: '-8deg' }],
  },
  stampSkip: {
    top: 28,
    right: 18,
    transform: [{ rotate: '8deg' }],
  },
  stampUnseen: {
    top: 28,
    alignSelf: 'center',
    left: 50,
  },
  stampText: textStyle('body', { fontWeight: '800', letterSpacing: 0.5 }),
});
