import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { WizardQuestion } from '@/components/features/WizardQuestion';
import { ProgressBar, Screen } from '@/components/ui';
import { useMoodWizard } from '@/features/mood/useMoodWizard';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';

export default function MoodWizardScreen() {
  const { question, index, total, selectedIds, onAnswer, onAdvance, close } = useMoodWizard();
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, SHADOWS.card]}
        >
          <X size={22} color={COLORS.textPrimary} strokeWidth={2.25} />
        </Pressable>
        <View style={styles.progress}>
          <ProgressBar value={index} max={total} segments={total} />
        </View>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <WizardQuestion
          key={question.id}
          question={question}
          index={index}
          total={total}
          selectedIds={selectedIds}
          onAnswer={onAnswer}
          onAdvance={onAdvance}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1, paddingBottom: 40, paddingTop: 40 },
});
