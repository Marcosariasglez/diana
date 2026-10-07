import { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { RATING_MAX, RATING_MIN, RATING_STEP } from '@/constants/rating';
import { COLORS } from '@/theme/colors';
import type { Rating } from '@/types/rating';
import { formatRating } from '@/utils/format';

export interface StarRatingProps {
  value: Rating | null;
  onChange?: (value: Rating) => void;
  size?: number;
  readOnly?: boolean;
  /** Sin ancho minimo de 44 por estrella: solo para vistas de solo lectura en tarjetas estrechas. */
  compact?: boolean;
}

/** Siguiente valor al incrementar/decrementar 0,5. Devuelve null si no cambia. */
export function stepRating(value: Rating | null, delta: 1 | -1): Rating | null {
  if (value === null) return delta === 1 ? (RATING_MIN as Rating) : null;
  const next = Math.round((value + delta * RATING_STEP) * 2) / 2;
  if (next < RATING_MIN || next > RATING_MAX) return null;
  return next as Rating;
}

type StarFill = 'full' | 'half' | 'empty';

function fillFor(value: number, starNumber: number): StarFill {
  if (value >= starNumber) return 'full';
  if (value >= starNumber - 0.5) return 'half';
  return 'empty';
}

const ACTIONS = [
  { name: 'increment', label: 'Subir media estrella' },
  { name: 'decrement', label: 'Bajar media estrella' },
];

export function StarRating({ value, onChange, size = 36, readOnly = false, compact = false }: StarRatingProps) {
  const interactive = !readOnly && onChange !== undefined;
  const current = value ?? 0;

  const handleAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (!onChange) return;
      const next = stepRating(
        value,
        e.nativeEvent.actionName === 'increment' ? 1 : -1,
      );
      if (next !== null) onChange(next);
    },
    [onChange, value],
  );

  return (
    <View
      accessible
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel="Tu nota"
      accessibilityValue={{ text: value === null ? 'Sin nota' : `${formatRating(value)} de 5` }}
      accessibilityActions={interactive ? ACTIONS : undefined}
      onAccessibilityAction={interactive ? handleAction : undefined}
      style={styles.row}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = fillFor(current, n);
        return (
          <View
            key={n}
            style={[styles.cell, { minHeight: compact ? size : Math.max(44, size) }, compact && styles.cellCompact]}
          >
            <View style={{ width: size, height: size }}>
              <Star size={size} color={COLORS.accent} strokeWidth={2} />
              {fill !== 'empty' ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.fillClip,
                    { width: fill === 'half' ? size / 2 : size, height: size },
                  ]}
                >
                  <Star size={size} color={COLORS.accent} fill={COLORS.accent} strokeWidth={2} />
                </View>
              ) : null}
            </View>
            {interactive ? (
              <View style={styles.halves}>
                <Pressable
                  testID={`star-${n}-left`}
                  accessible={false}
                  onPress={() => onChange?.((n - 0.5) as Rating)}
                  style={styles.half}
                />
                <Pressable
                  testID={`star-${n}-right`}
                  accessible={false}
                  onPress={() => onChange?.(n as Rating)}
                  style={styles.half}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cell: {
    flex: 1,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCompact: {
    minWidth: 0,
  },
  fillClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  halves: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  half: {
    flex: 1,
  },
});
