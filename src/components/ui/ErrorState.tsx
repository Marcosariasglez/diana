import { StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  /** Texto del boton (por defecto "Reintentar"). */
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Reintentar' }: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.wrap}>
      <TriangleAlert size={32} color={COLORS.textSecondary} />
      <Text style={[textStyle('body'), styles.message]}>{message}</Text>
      <Button label={retryLabel} variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 32 },
  message: { color: COLORS.textPrimary, textAlign: 'center' },
});
