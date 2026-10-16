import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { Reason } from '@/types/media';

export interface ReasonLineProps {
  /** Razón del recomendador; también acepta el texto suelto. Sin texto no pinta nada. */
  reason?: Reason | string;
  numberOfLines?: number;
}

/** Icono + razón textual («Porque te gustó X»). Nunca muestra notas numéricas. */
export function ReasonLine({ reason, numberOfLines = 1 }: ReasonLineProps) {
  const { colors } = useTheme();
  const text = (typeof reason === 'string' ? reason : reason?.text)?.trim();
  if (!text) return null;
  return (
    <View style={styles.row} testID="reason-line">
      <Sparkles size={14} color={colors.acc} strokeWidth={2.25} accessibilityElementsHidden />
      <Text
        numberOfLines={numberOfLines}
        style={[textStyle('bodySmall', { color: colors.acc, fontFamily: 'Inter-Bold' }), styles.text]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { flexShrink: 1 },
});
