import { Platform, Pressable, type ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';

export interface FabButtonProps {
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
}

/** FAB X2: círculo 58, fondo acc, icono onAcc, sobresale 16, sombra acc 40 % (solo claro). */
export function FabButton({
  onPress,
  size = 58,
  accessibilityLabel = 'Registrar en el diario',
}: FabButtonProps) {
  const { colors, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const webShadow =
    !isDark && Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 20px rgba(11,122,102,0.4)' } as ViewStyle)
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.acc,
          alignItems: 'center',
          justifyContent: 'center',
        },
        webShadow,
        !isDark && SHADOWS.fab,
        pressed && { opacity: 0.88 },
      ]}
    >
      <Plus size={size * 0.5} color={colors.onAcc} strokeWidth={2.5} />
    </Pressable>
  );
}
