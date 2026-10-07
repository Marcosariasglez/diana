import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { haptic } from '@/hooks/useHaptics';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { MoodQuestion } from '@/types/mood';
import { toJS } from '@/utils/worklets';
import { AnswerTile } from './AnswerTile';

export interface WizardQuestionProps {
  question: MoodQuestion;
  /** Se llama al instante al tocar una respuesta (guardar en el store). */
  onAnswer: (answerId: string) => void;
  /** Se llama al terminar el fundido de salida (avanzar o finalizar). */
  onAdvance?: () => void;
  /** Ids seleccionados (para preguntas de seleccion multiple o preseleccion). */
  selectedIds?: string[];
  /** 1-based, para "PREGUNTA N DE M". */
  index?: number;
  total?: number;
}

export function WizardQuestion({
  question,
  onAnswer,
  onAdvance,
  selectedIds = [],
  index,
  total,
}: WizardQuestionProps) {
  const reduced = useMotionPreference();
  const opacity = useSharedValue(0);
  const locked = useRef(false);
  const multiple = question.selection === 'multiple';

  // Entrada al montar la pregunta (el padre usa key={question.id}).
  useEffect(() => {
    locked.current = false;
    opacity.value = withTiming(1, { duration: reduced ? 0 : 125 });
  }, [question.id, reduced, opacity]);

  const advance = () => {
    haptic('light');
    onAdvance?.();
  };

  const fadeOutThenAdvance = () => {
    if (locked.current) return;
    locked.current = true;
    opacity.value = withTiming(0, { duration: reduced ? 0 : 125 }, (finished) => {
      if (finished) toJS(advance)();
    });
  };

  const handleTile = (answerId: string) => {
    if (locked.current) return;
    onAnswer(answerId);
    if (!multiple) fadeOutThenAdvance();
  };

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const rows: (typeof question.options)[] = [];
  for (let i = 0; i < question.options.length; i += 2) {
    rows.push(question.options.slice(i, i + 2));
  }

  return (
    <Animated.View style={[styles.root, style]}>
      {index !== undefined && total !== undefined ? (
        <Text style={[textStyle('label', { color: COLORS.textSecondary }), styles.eyebrow]}>
          {`PREGUNTA ${index} DE ${total}`}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.2}
        style={[textStyle('wizardQuestion', { color: COLORS.textPrimary }), styles.question]}
      >
        {question.title}
      </Text>
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0].id} style={styles.gridRow}>
            {row.map((opt) => (
              <AnswerTile
                key={opt.id}
                icon={opt.icon}
                title={opt.title}
                subtitle={opt.subtitle}
                selected={selectedIds.includes(opt.id)}
                multiple={multiple}
                onPress={() => handleTile(opt.id)}
              />
            ))}
            {row.length === 1 ? <View style={styles.filler} /> : null}
          </View>
        ))}
      </View>
      {multiple ? (
        <Pressable
          onPress={fadeOutThenAdvance}
          disabled={selectedIds.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Continuar"
          accessibilityState={{ disabled: selectedIds.length === 0 }}
          style={[styles.continue, selectedIds.length === 0 && styles.continueDisabled]}
        >
          <Text
            style={textStyle('body', {
              fontWeight: '700',
              color: selectedIds.length === 0 ? COLORS.textSecondary : '#FFFFFF',
            })}
          >
            Continuar
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  eyebrow: {
    textAlign: 'center',
    marginTop: 24,
  },
  question: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  grid: {
    gap: 14,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 14,
  },
  filler: {
    flex: 1,
  },
  continue: {
    marginTop: 24,
    minHeight: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.buttonPrimary,
  },
  continueDisabled: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
});
