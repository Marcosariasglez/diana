import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { MoodQuestion } from '@/types/mood';

export interface MoodAnswerListProps {
  questions: MoodQuestion[];
  /** questionId -> id de respuesta (seleccion multiple: ids separados por coma). */
  answers: Record<string, string>;
}

export function MoodAnswerList({ questions, answers }: MoodAnswerListProps) {
  const { colors } = useTheme();

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
            <Text style={textStyle('label', { color: colors.textSecondary })}>
              {`PREGUNTA ${i + 1} DE ${questions.length}`}
            </Text>
            <Text style={textStyle('body', { fontFamily: 'Manrope-Bold', color: colors.ink })}>
              {q.title}
            </Text>
            <View style={styles.chips}>
              {chosen.length > 0 ? (
                chosen.map((c) => {
                  const Icon = c.icon;
                  return (
                    <View key={c.id} style={[styles.chip, { backgroundColor: colors.accSoft }]}>
                      <Icon size={16} color={colors.acc} strokeWidth={2} />
                      <Text
                        style={textStyle('bodySmall', {
                          fontFamily: 'Inter-Bold',
                          color: colors.acc,
                        })}
                      >
                        {c.title}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={[styles.chip, styles.waiting, { backgroundColor: colors.chip }]}>
                  <Text style={textStyle('bodySmall', { color: colors.textSecondary })}>
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
  list: { gap: 20 },
  item: { gap: 6 },
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
    borderRadius: 99,
  },
  waiting: {},
});
