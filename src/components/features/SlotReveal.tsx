import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Lock } from 'lucide-react-native';
import { haptic } from '@/hooks/useHaptics';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { formatRating } from '@/utils/format';
import { toJS } from '@/utils/worklets';

export type SlotState = 'locked' | 'rolling' | 'revealed';

export interface SlotRevealProps {
  value: number | null;
  state: SlotState;
  animated: boolean;
  onRevealed?: () => void;
  /** Texto del estado locked. Por defecto "Guarda tu nota para ver la predicción". */
  lockedHint?: string;
}

const ROW_H = 44;
const REPEATS = 4;
const ROWS = 10 * REPEATS;
const LOOP_MS = 600;
const MIN_SPIN_MS = 700;
const INT_BRAKE_MS = 1000;
const DEC_BRAKE_MS = 1200;
const DEC_DELAY_MS = 200;
const ROWS_INDEX = Array.from({ length: ROWS }, (_, i) => i);
const WHITE = '#FFFFFF';

function settleColumn(
  y: SharedValue<number>,
  target: number,
  brakeMs: number,
  onSettled: () => void,
) {
  'worklet';
  cancelAnimation(y);
  const phase = y.value % 10;
  const delta = (target - phase + 10) % 10;
  const end = phase + 10 + delta;
  y.value = phase;
  y.value = withSequence(
    withTiming(end + 0.15, { duration: brakeMs, easing: Easing.out(Easing.cubic) }),
    withSpring(end, { damping: 14, stiffness: 220, mass: 0.6 }, (finished) => {
      if (finished) onSettled();
    }),
  );
}

function DigitRow({ index, y, color }: { index: number; y: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(index - y.value);
    return {
      opacity: interpolate(d, [0, 1, 2], [1, 0.3, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.85], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[styles.row, style]}>
      <Text style={[textStyle('predictionRevealed', { color }), styles.digit]}>{index % 10}</Text>
    </Animated.View>
  );
}

function DigitColumn({ y, color }: { y: SharedValue<number>; color: string }) {
  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -y.value * ROW_H + ROW_H }],
  }));
  return (
    <View style={styles.window} accessibilityElementsHidden importantForAccessibility="no">
      <Animated.View style={[styles.strip, stripStyle]}>
        {ROWS_INDEX.map((i) => (
          <DigitRow key={i} index={i} y={y} color={color} />
        ))}
      </Animated.View>
    </View>
  );
}

function SlotRevealBase({ value, state, animated, onRevealed, lockedHint }: SlotRevealProps) {
  const { colors } = useTheme();
  const reduced = useMotionPreference();
  const yInt = useSharedValue(0);
  const yDec = useSharedValue(3);
  const gateInt = useSharedValue(0);
  const gateDec = useSharedValue(0);
  const progress = useSharedValue(state === 'revealed' ? 1 : 0);
  const chipScale = useSharedValue(state === 'revealed' ? 1 : 0);
  const bodyOpacity = useSharedValue(1);
  const fade = useSharedValue(0);

  const rollStart = useRef(0);
  const stopStarted = useRef(false);
  const prevState = useRef<SlotState>(state);
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  const notifyRevealed = () => {
    onRevealedRef.current?.();
  };

  useEffect(() => {
    if (state !== 'rolling') return;
    stopStarted.current = false;
    rollStart.current = Date.now();
    fade.value = 0;
    if (!reduced) {
      yInt.value = 0;
      yDec.value = 3;
      yInt.value = withRepeat(
        withTiming(10, { duration: LOOP_MS, easing: Easing.linear }),
        -1,
        false,
      );
      yDec.value = withRepeat(
        withTiming(13, { duration: LOOP_MS, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(yInt);
      cancelAnimation(yDec);
      cancelAnimation(gateInt);
      cancelAnimation(gateDec);
    };
  }, [state, reduced, yInt, yDec, gateInt, gateDec, fade]);

  useEffect(() => {
    if (state !== 'rolling' || value === null || stopStarted.current) return;
    stopStarted.current = true;

    if (reduced) {
      fade.value = withTiming(1, { duration: 300 }, (finished) => {
        if (finished) toJS(notifyRevealed)();
      });
      return;
    }

    const tenths = Math.round(value * 10);
    const dInt = Math.floor(tenths / 10) % 10;
    const dDec = tenths % 10;
    const remaining = Math.max(0, MIN_SPIN_MS - (Date.now() - rollStart.current));
    const settledInt = () => {
      haptic('light');
    };
    const settledDec = () => {
      haptic('medium');
      notifyRevealed();
    };

    gateInt.value = 0;
    gateInt.value = withTiming(1, { duration: remaining }, (finished) => {
      if (finished) settleColumn(yInt, dInt, INT_BRAKE_MS, toJS(settledInt));
    });
    gateDec.value = 0;
    gateDec.value = withTiming(1, { duration: remaining + DEC_DELAY_MS }, (finished) => {
      if (finished) settleColumn(yDec, dDec, DEC_BRAKE_MS, toJS(settledDec));
    });
  }, [state, value, reduced]);

  useEffect(() => {
    const prev = prevState.current;
    prevState.current = state;
    if (state === 'revealed') {
      if (!animated) {
        progress.value = 1;
        chipScale.value = 1;
        return;
      }
      progress.value = withTiming(1, { duration: reduced ? 300 : 250 });
      chipScale.value = reduced
        ? withTiming(1, { duration: 300 })
        : withSpring(1, { damping: 12, stiffness: 180 });
      haptic('success');
      return;
    }
    progress.value = 0;
    chipScale.value = 0;
    if (state === 'locked' && prev === 'rolling') {
      bodyOpacity.value = 0;
      bodyOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [state, animated, reduced, progress, chipScale, bodyOpacity]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.card, colors.acc]),
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const valueColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.ink, WHITE]),
  }));
  const titleColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textSecondary, 'rgba(255,255,255,0.85)']),
  }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipScale.value,
    transform: [{ scale: interpolate(chipScale.value, [0, 1], [0.6, 1]) }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyOpacity.value }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const finalText = formatRating(value);

  const a11yLabel =
    state === 'revealed' && value !== null
      ? `Predicción de IA: ${finalText} de 5. Desbloqueada`
      : state === 'rolling'
        ? 'Predicción de IA: calculando'
        : 'Predicción de IA bloqueada';

  return (
    <View style={styles.wrapper}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, haloStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Animated.View
        accessible
        accessibilityLabel={a11yLabel}
        accessibilityLiveRegion="polite"
        style={[styles.card, { borderTopColor: colors.acc }, cardStyle]}
      >
        <Animated.Text style={[textStyle('label'), styles.title, titleColorStyle]}>
          PREDICCIÓN IA
        </Animated.Text>

        <Animated.View style={[styles.body, bodyStyle]}>
          {state === 'locked' ? (
            <>
              <View style={styles.lockedRow}>
                <Lock size={22} color={colors.textSecondary} strokeWidth={2} />
                <Text style={textStyle('predictionRevealed', { color: colors.textSecondary })}>
                  ?,?
                </Text>
              </View>
              <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
                {lockedHint ?? 'Guarda tu nota para ver la predicción'}
              </Text>
            </>
          ) : null}

          {state === 'rolling' && !reduced ? (
            <>
              <View style={styles.slotRow}>
                <DigitColumn y={yInt} color={colors.acc} />
                <Text style={[textStyle('predictionRevealed', { color: colors.acc }), styles.comma]}>
                  ,
                </Text>
                <DigitColumn y={yDec} color={colors.acc} />
              </View>
              <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
                Calculando...
              </Text>
            </>
          ) : null}

          {state === 'rolling' && reduced ? (
            <>
              <Animated.View style={fadeStyle}>
                <Text style={textStyle('predictionRevealed', { color: colors.acc })}>
                  {value === null ? '' : finalText}
                </Text>
              </Animated.View>
              <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
                Calculando...
              </Text>
            </>
          ) : null}

          {state === 'revealed' ? (
            <>
              <View style={styles.valueRow}>
                <Animated.Text
                  maxFontSizeMultiplier={1.3}
                  style={[textStyle('predictionRevealed'), valueColorStyle]}
                >
                  {finalText}
                </Animated.Text>
                <Animated.Text style={[textStyle('body', { fontVariant: ['tabular-nums'] }), titleColorStyle]}>/ 5</Animated.Text>
              </View>
              <Animated.View style={[styles.chip, chipStyle]}>
                <Text style={textStyle('label', { color: colors.acc, letterSpacing: 0 })}>
                  Desbloqueada
                </Text>
              </Animated.View>
            </>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export const SlotReveal = memo(SlotRevealBase);

const styles = StyleSheet.create({
  wrapper: { flex: 1, minHeight: 148 },
  halo: {
    ...StyleSheet.absoluteFill,
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'rgba(11,122,102,0.2)',
  },
  card: { flex: 1, borderRadius: 24, padding: 16, borderTopWidth: 2, overflow: 'hidden' },
  title: { marginBottom: 8 },
  body: { flex: 1, gap: 8 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', height: ROW_H * 3 },
  window: { width: 30, height: ROW_H * 3, overflow: 'hidden' },
  strip: { position: 'absolute', top: 0, left: 0, right: 0, height: ROW_H * ROWS },
  row: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  digit: { lineHeight: ROW_H, textAlign: 'center' },
  comma: { lineHeight: ROW_H, marginHorizontal: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 32,
    justifyContent: 'center',
  },
});
