import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { toJS } from '@/utils/worklets';

export interface BottomSheetProps {
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
  /** Fracciones (0-1] de la altura de pantalla; la mayor fija la altura maxima. Por defecto [0.7]. */
  snapPoints?: number[];
}

const SPRING = { damping: 20, stiffness: 200 };
const CLOSE_VELOCITY = 800;
const CLOSE_DISTANCE = 100;

export function BottomSheet({ children, visible, onClose, snapPoints = [0.7] }: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const overlay = useSharedValue(0);
  const maxHeight = Math.min(1, Math.max(...snapPoints)) * height;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = reduced ? withTiming(0, { duration: 150 }) : withSpring(0, SPRING);
      overlay.value = withTiming(0.3, { duration: 200 });
    } else {
      overlay.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(height, { duration: 220 }, (finished) => {
        if (finished) toJS(setMounted)(false);
      });
    }
  }, [visible, height, reduced, translateY, overlay]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.velocityY > CLOSE_VELOCITY || e.translationY > CLOSE_DISTANCE) {
        overlay.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(height, { duration: 200 }, (finished) => {
          if (finished) toJS(onClose)();
        });
      } else {
        translateY.value = reduced ? withTiming(0, { duration: 150 }) : withSpring(0, SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  if (!mounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar panel"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View testID="bottom-sheet" style={[styles.sheet, { maxHeight }, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea} accessibilityLabel="Arrastra hacia abajo para cerrar">
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 50 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.sheet,
  },
  handleArea: { height: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.divider },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
});
