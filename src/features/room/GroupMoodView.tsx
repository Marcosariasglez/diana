import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { AnswerTile } from '@/components/features/AnswerTile';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { MoodQuestion } from '@/types/mood';
import { selectedOptions } from './useGroupMood';

export interface GroupMoodViewProps {
  questions: MoodQuestion[];
  answers: Record<string, string>;
  isHost: boolean;
  moodComplete: boolean;
  confirming?: boolean;
  onSelect: (questionId: string, answerId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

function QuestionHeader({ index, total, title }: { index: number; total: number; title: string }) {
  return (
    <View style={styles.qHeader}>
      <Text style={textStyle('label', { color: COLORS.textSecondary })}>{`PREGUNTA ${index} DE ${total}`}</Text>
      <Text accessibilityRole="header" style={textStyle('body', { fontWeight: '800', fontSize: 20, color: COLORS.textPrimary })}>
        {title}
      </Text>
    </View>
  );
}

export function GroupMoodView({
  questions,
  answers,
  isHost,
  moodComplete,
  confirming = false,
  onSelect,
  onConfirm,
  onBack,
}: GroupMoodViewProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, SHADOWS.card]}
        >
          <ChevronLeft size={24} color={COLORS.textPrimary} strokeWidth={2.25} />
        </Pressable>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
          Filtros del grupo
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {questions.map((q, i) => {
          const chosen = selectedOptions(q, answers[q.id]);
          const multiple = q.selection === 'multiple';
          const selectedIds = chosen.map((o) => o.id);
          const rows: (typeof q.options)[] = [];
          for (let k = 0; k < q.options.length; k += 2) rows.push(q.options.slice(k, k + 2));
          return (
            <View key={q.id} style={styles.section}>
              <QuestionHeader index={i + 1} total={questions.length} title={q.title} />
              {isHost ? (
                <View style={styles.grid}>
                  {rows.map((row) => (
                    <View key={row[0].id} style={styles.gridRow}>
                      {row.map((opt) => (
                        <AnswerTile
                          key={opt.id}
                          icon={opt.icon}
                          title={opt.title}
                          subtitle={opt.subtitle}
                          multiple={multiple}
                          selected={selectedIds.includes(opt.id)}
                          onPress={() => onSelect(q.id, opt.id)}
                        />
                      ))}
                      {row.length === 1 ? <View style={styles.filler} /> : null}
                    </View>
                  ))}
                </View>
              ) : chosen.length > 0 ? (
                <View style={styles.chips} accessible accessibilityLabel={`${q.title} ${chosen.map((c) => c.title).join(', ')}`}>
                  {chosen.map((c) => (
                    <Chip key={c.id} label={c.title} icon={c.icon} variant="accent" />
                  ))}
                </View>
              ) : (
                <View style={styles.waiting} accessible accessibilityLabel={`${q.title} Esperando...`}>
                  <Skeleton width={96} height={28} radius={14} />
                  <Text style={textStyle('bodySmall', { color: COLORS.textSecondary })}>Esperando...</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {isHost ? (
          <Button label="Confirmar filtros" onPress={onConfirm} disabled={!moodComplete} loading={confirming} />
        ) : (
          <Text style={[textStyle('body', { fontWeight: '600', color: COLORS.textSecondary }), styles.note]}>
            El anfitrión está eligiendo los filtros
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.textPrimary },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 28 },
  section: { gap: 12 },
  qHeader: { gap: 4 },
  grid: { gap: 14 },
  gridRow: { flexDirection: 'row', gap: 14 },
  filler: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  note: { textAlign: 'center', paddingVertical: 18 },
});
