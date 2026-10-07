import { Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';

export interface FabButtonProps {
  onPress: () => void;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

export function FabButton({
  onPress,
  size = 56,
  color = COLORS.accent,
  accessibilityLabel = 'Registrar en el diario',
}: FabButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        pressed && styles.pressed,
      ]}
    >
      <Plus size={size * 0.5} color="#FFFFFF" strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { alignItems: 'center', justifyContent: 'center', ...SHADOWS.fab },
  pressed: { opacity: 0.88 },
});
