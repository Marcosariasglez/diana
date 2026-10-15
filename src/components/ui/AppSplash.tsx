import { useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { dark, light } from '@/theme/tokens';
import { scheduleOnRN } from 'react-native-worklets';
import { BrandMark } from './BrandMark';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const MIN_VISIBLE_MS = 700;

export interface AppSplashProps {
  /** `true` cuando la app ya puede mostrarse; la pantalla se desvanece y se desmonta. */
  ready: boolean;
}

/** Pantalla de carga VERTICE: marca de la app + «by VERTICE». Misma que en Norte
 *  (invest/src/index.html, #vSplash): entrada con fundido, marca que «respira», salida suave. */
export function AppSplash({ ready }: AppSplashProps) {
  const colors = useColorScheme() === 'dark' ? dark : light;
  const reduced = useReducedMotion();
  const [mountedAt] = useState(() => Date.now());
  const [gone, setGone] = useState(false);
  const enter = useSharedValue(reduced ? 1 : 0);
  const breath = useSharedValue(1);
  const exit = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    enter.value = withTiming(1, { duration: 420, easing: EASE });
    breath.value = withDelay(
      420,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [reduced, enter, breath]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt));
    const t = setTimeout(() => {
      exit.value = withTiming(0, { duration: reduced ? 1 : 280, easing: EASE }, (finished) => {
        if (finished) scheduleOnRN(setGone, true);
      });
    }, wait);
    return () => clearTimeout(t);
  }, [ready, reduced, mountedAt, exit]);

  const root = useAnimatedStyle(() => ({ opacity: exit.value }));
  const mark = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 6 }, { scale: breath.value }],
  }));
  const text = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 6 }],
  }));

  if (gone) return null;
  return (
    <Animated.View
      testID="app-splash"
      accessibilityRole="progressbar"
      accessibilityLabel="Cargando Diana"
      pointerEvents={ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.bg }, root]}
    >
      <Animated.View style={mark}>
        <BrandMark size={72} background={colors.acc} foreground={colors.onAcc} />
      </Animated.View>
      <Animated.View style={[styles.texts, text]}>
        <Text style={[styles.name, { color: colors.ink }]}>Diana</Text>
        <Text style={[styles.by, { color: colors.mut }]}>BY VERTICE</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  texts: { alignItems: 'center', marginTop: 18 },
  name: { fontFamily: 'Manrope-ExtraBold', fontSize: 28, letterSpacing: -0.03 * 28 },
  by: { fontFamily: 'Inter-SemiBold', fontSize: 12.5, letterSpacing: 0.06 * 12.5, marginTop: 6 },
});
