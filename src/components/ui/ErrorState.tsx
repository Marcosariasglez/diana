import { StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  /** Texto del boton (por defecto "Reintentar"). */
  retryLabel?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Reintentar' }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={styles.wrap}>
      <TriangleAlert size={32} color={colors.textSecondary} />
      <Text style={[textStyle('body'), { color: colors.ink, textAlign: 'center' }]}>{message}</Text>
      <Button label={retryLabel} variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 32 },
});
