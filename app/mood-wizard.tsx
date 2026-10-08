import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { WizardQuestion } from '@/components/features/WizardQuestion';
import { ProgressBar, Screen } from '@/components/ui';
import { useMoodWizard } from '@/features/mood/useMoodWizard';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';

export default function MoodWizardScreen() {
  const { question, index, total, selectedIds, onAnswer, onAdvance, close } = useMoodWizard();
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 16,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    close: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    progress: { flex: 1 },
    body: { flex: 1 },
    bodyContent: { flexGrow: 1, paddingBottom: 40, paddingTop: 40 },
  }));

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, SHADOWS.card]}
        >
          <X size={20} color={colors.ink} strokeWidth={2} />
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

