import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@/theme/colors';

export interface SkeletonProps {
  width: DimensionValue;
  height: number;
  radius?: number;
}

export function Skeleton({ width, height, radius = 8 }: SkeletonProps) {
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
  }, [reduced, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      testID="skeleton"
      style={[
        { width, height, borderRadius: radius, backgroundColor: COLORS.divider },
        animated,
      ]}
    />
  );
}
