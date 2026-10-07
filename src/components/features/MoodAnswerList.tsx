import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';
import type { MoodQuestion } from '@/types/mood';

export interface MoodAnswerListProps {
  questions: MoodQuestion[];
  /** questionId -> id de respuesta (seleccion multiple: ids separados por coma). */
  answers: Record<string, string>;
}

export function MoodAnswerList({ questions, answers }: MoodAnswerListProps) {
  return (
    <View style={styles.list}>
      {questions.map((q, i) => {
        const raw = answers[q.id];
        const ids = raw ? raw.split(',').filter(Boolean) : [];
        const chosen = q.options.filter((o) => ids.includes(o.id));
        return (
          <View
            key={q.id}
            accessible
            accessibilityLabel={
              chosen.length > 0
                ? `${q.title} ${chosen.map((c) => c.title).join(', ')}`
                : `${q.title} Esperando...`
            }
            style={styles.item}
          >
            <Text style={textStyle('label', { color: COLORS.textSecondary })}>
              {`PREGUNTA ${i + 1} DE ${questions.length}`}
            </Text>
            <Text style={textStyle('body', { fontWeight: '700', color: COLORS.textPrimary })}>
              {q.title}
            </Text>
            <View style={styles.chips}>
              {chosen.length > 0 ? (
                chosen.map((c) => {
                  const Icon = c.icon;
                  return (
                    <View key={c.id} style={styles.chip}>
                      <Icon size={16} color={COLORS.accentSoftText} strokeWidth={2} />
                      <Text
                        style={textStyle('bodySmall', {
                          fontWeight: '700',
                          color: COLORS.accentSoftText,
                        })}
                      >
                        {c.title}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={[styles.chip, styles.waiting]}>
                  <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>
                    Esperando...
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 20,
  },
  item: {
    gap: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: COLORS.accentSoft,
  },
  waiting: {
    backgroundColor: COLORS.surfaceNeutral,
  },
});
